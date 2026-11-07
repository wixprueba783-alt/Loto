import dotenv from "dotenv"

import { createHash, randomUUID } from "node:crypto"

import { existsSync } from "node:fs"

import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"

import path from "node:path"

import { fileURLToPath } from "node:url"

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app"

import { getAuth } from "firebase-admin/auth"

import { FieldValue, getFirestore } from "firebase-admin/firestore"

import whatsappWeb from "whatsapp-web.js"

import { listenWithRecovery } from "./listener-recovery.js"

import {
  appointmentConfirmedMessage,
  appointmentReceivedMessage,
  appointmentReminderMessage,
  appointmentTimestamp,
  formatAppointmentTemplate,
  isAppointmentReminderDue,
  normalizePhone,
  serializeWhatsAppId,
} from "./notifications.js"

const { Client, LocalAuth } = whatsappWeb

// whatsapp-web.js puede rechazar promesas sin manejar (p. ej. al borrar la
// sesión con EBUSY mientras Chrome aún corre). Sin estos manejadores, Node
// terminaría el proceso completo y se llevaría el servidor de desarrollo.
process.on("unhandledRejection", (reason) => {
  console.error("Rechazo de promesa no manejado en whatsapp-service:", reason)
})

process.on("uncaughtException", (error) => {
  console.error("Excepción no capturada en whatsapp-service:", error)
})

const directory = path.dirname(fileURLToPath(import.meta.url))

const resolveFromService = (value) => path.resolve(directory, value)

const envPath = resolveFromService("./.env")

dotenv.config({ path: envPath })

if (
  process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolveFromService(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  )
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credentialCandidates = [
    "/etc/secrets/service-account.json",
    resolveFromService("./service-account.json"),
  ]
  const credentialPath = credentialCandidates.find((candidate) =>
    existsSync(candidate),
  )
  if (credentialPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath
  }
}

function sessionDirPath() {
  return path.join(
    process.env.WHATSAPP_LOCAL_AUTH_DIR ??
      path.join(
        process.env.LOCALAPPDATA ?? directory,
        "LotoWhatsapp",
        "wwebjs_auth",
      ),
    "session-loto-appointments-v2",
  )
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Espera a que Chrome libere el lockfile de la sesión para poder reutilizar
// el directorio sin chocar con "The browser is already running".
async function waitForSessionRelease(timeoutMs = 20_000) {
  const lockPath = path.join(sessionDirPath(), "lockfile")
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const handle = await open(lockPath, "r+")

      await handle.close()

      return
    } catch (error) {
      if (error?.code === "ENOENT") return

      await wait(500)
    }
  }

  console.error(
    `El lockfile de la sesión de WhatsApp siguió ocupado tras ${timeoutMs} ms.`,
  )
}

// Tras un LOGOUT la sesión queda inválida; whatsapp-web.js intenta borrarla
// pero puede fallar con EBUSY si Chrome aún no cerró. Aquí se reintenta.
async function clearWhatsAppSession() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await rm(sessionDirPath(), { recursive: true, force: true, maxRetries: 3 })

      return
    } catch (error) {
      console.error(
        `No se pudo limpiar la sesión de WhatsApp (intento ${attempt}/6):`,
        error,
      )

      await wait(1_000)
    }
  }
}

export function createWhatsAppService() {
  const status = {
    state: "starting",

    qr: null,

    message: "Iniciando conexión con WhatsApp…",
  }

  const processedIds = new Set()

  const pendingNotifications = new Map()

  const knownAppointments = new Map()

  function createWhatsAppClient() {
    return new Client({
      authStrategy: new LocalAuth({
        clientId: "loto-appointments-v2",

        dataPath: path.resolve(
          process.env.WHATSAPP_LOCAL_AUTH_DIR ??
            path.join(
              process.env.LOCALAPPDATA ?? directory,
              "LotoWhatsapp",
              "wwebjs_auth",
            ),
        ),
      }),

       puppeteer: {
         ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
         headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      },

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    })
  }

  let client = createWhatsAppClient()

  let firestore

  let adminAuth

  let appointments

  let whatsappReady = false

  let dispatching = false

  let reminderSweepInProgress = false

  let reminderHours = 24
  let automationSettings = {
    enabled: {},
    templates: {},
    adminPhones: { main: "", north: "" },
  }
  const allowedNotificationStages = new Set(["received", "confirmed", "reminder"])

  let stopListening = () => {}

  let stopSettingsListening = () => {}

  let retryTimer

  let reminderTimer

  let startPromise

  let stopping = false

  let whatsappRecoveryPromise

  let whatsappRecoveryTimer

  let whatsappRetryCount = 0

  function checkpointPath() {
    return resolveFromService(
      process.env.NOTIFIED_APPOINTMENTS_FILE ??
        "./.data/notified-appointments.json",
    )
  }

  async function loadCheckpoint() {
    try {
      const savedIds = JSON.parse(await readFile(checkpointPath(), "utf8"))

      if (
        !Array.isArray(savedIds) ||
        savedIds.some((id) => typeof id !== "string")
      ) {
        throw new Error(
          `El archivo ${checkpointPath()} no tiene un formato válido.`,
        )
      }

      savedIds.forEach((id) => processedIds.add(id))

      return true
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return false

      throw error
    }
  }

  async function saveCheckpoint() {
    const filePath = checkpointPath()

    await mkdir(path.dirname(filePath), { recursive: true })

    const temporaryPath = `${filePath}.tmp`

    await writeFile(temporaryPath, JSON.stringify([...processedIds]), "utf8")

    await rename(temporaryPath, filePath)
  }

  async function markProcessed(id) {
    processedIds.add(id)

    await saveCheckpoint()
  }

  function scheduleRetry(delay = 30_000) {
    if (retryTimer) return

    retryTimer = setTimeout(() => {
      retryTimer = undefined

      void dispatchPendingNotifications()
    }, delay)
  }

  function notificationKey(id, stage, appointment) {
    if (stage === "received") return id

    if (stage === "confirmed") return `confirmed:${id}`

    return `reminder:${id}:${appointment.date}:${appointment.time}`
  }

  function isAutomationEnabled(stage) {
    const enabled = automationSettings.enabled?.[stage]
    return enabled !== false
  }

  function notificationRecipient(stage, appointment) {
    return normalizePhone(appointment.clientPhone)
  }

  function notificationMessage(stage, appointment) {
    if (automationSettings.templateVersion === 2) {
      const template = automationSettings.templates?.[stage]
      if (template) return formatAppointmentTemplate(template, appointment)
    }
    if (stage === "received") return appointmentReceivedMessage(appointment)
    if (stage === "confirmed") return appointmentConfirmedMessage(appointment)
    return appointmentReminderMessage(appointment)
  }

  function maskedPhone(phone) {
    const digits = String(phone ?? "").replace(/\D/g, "")
    return digits.length >= 4 ? `••••${digits.slice(-4)}` : "no disponible"
  }

  function safeErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error)
    return message.replace(/\+?\d[\d\s()-]{7,}\d/g, "[teléfono oculto]").slice(0, 400)
  }

  function enqueueNotification(id, stage, appointment) {
    if (!allowedNotificationStages.has(stage)) return
    if (!isAutomationEnabled(stage)) return
    const key = notificationKey(id, stage, appointment)

    if (processedIds.has(key) || pendingNotifications.has(key)) return

    pendingNotifications.set(key, {
      id,

      stage,

      date: appointment.date,

      time: appointment.time,
    })

    void dispatchPendingNotifications()
  }

  async function dispatchPendingNotifications() {
    if (!whatsappReady || dispatching) return

    dispatching = true

    try {
      while (whatsappReady && pendingNotifications.size > 0) {
        const [key, notification] = pendingNotifications.entries().next().value

        pendingNotifications.delete(key)

        const { id: appointmentId, stage } = notification

        try {
          if (!allowedNotificationStages.has(stage)) {
            await markProcessed(key)
            continue
          }

          const latestSnapshot = await appointments.doc(appointmentId).get()

          if (!latestSnapshot.exists) {
            await markProcessed(key)

            continue
          }

          const appointment = latestSnapshot.data()

          if (
            stage === "received" &&
            appointment.status === "cancelled"
          ) {
            await markProcessed(key)

            continue
          }

          if (stage !== "received" && appointment.status !== "confirmed")
            continue

          if (stage === "reminder") {
            if (
              appointment.date !== notification.date ||
              appointment.time !== notification.time
            )
              continue

            if (
              !appointmentTimestamp(
                appointment,
                process.env.BUSINESS_TIME_ZONE ?? "America/Mexico_City",
              )
            ) {
              await markProcessed(key)

              continue
            }

            if (
              !isAppointmentReminderDue(
                appointment,
                Date.now(),
                process.env.BUSINESS_TIME_ZONE ?? "America/Mexico_City",
                reminderHours,
              )
            )
              continue
          }

          if (!isAutomationEnabled(stage)) {
            await markProcessed(key)
            continue
          }

          const recipient = notificationRecipient(stage, appointment)

          if (!recipient) {
            console.error(
              `No se envió WhatsApp para la cita ${appointmentId}: el teléfono de destino no es válido.`,
            )

            await firestore.collection("whatsappMessageLog").add({
              appointmentId,
              branchId: appointment.branchId ?? "main",
              stage,
              status: "failed",
              recipientMasked: maskedPhone(
                appointment.clientPhone,
              ),
              error: "El teléfono de destino no es válido.",
              createdAt: FieldValue.serverTimestamp(),
            })
            await markProcessed(key)

            continue
          }

          const message = notificationMessage(stage, appointment)

          const logRef = firestore
            .collection("whatsappMessageLog")
            .doc(createHash("sha256").update(key).digest("hex"))
          const previousLog = await logRef.get()
          const previousLogData = previousLog.data()
          if (previousLogData?.status === "sent") {
            await markProcessed(key)
            continue
          }
          if (previousLogData?.status === "pending") {
            await logRef.update({
              status: "failed",
              error: "No se pudo confirmar el resultado del intento anterior; se requiere revisión manual para evitar duplicados.",
              failedAt: FieldValue.serverTimestamp(),
            })
            await markProcessed(key)
            continue
          }
          await logRef.set({
            appointmentId,
            branchId: appointment.branchId ?? "main",
            stage,
            status: "pending",
            attempts: Number(previousLogData?.attempts ?? 0) + 1,
            recipientMasked: maskedPhone(
              appointment.clientPhone,
            ),
            ...(previousLog.exists
              ? {}
              : { createdAt: FieldValue.serverTimestamp() }),
            lastAttemptAt: FieldValue.serverTimestamp(),
            error: FieldValue.delete(),
            failedAt: FieldValue.delete(),
          }, { merge: true })

          try {
            const registeredId = await client.getNumberId(
              recipient.replace(/@c\.us$/, ""),
            )
            const chatId = serializeWhatsAppId(registeredId)
            if (!chatId) {
              throw new Error(
                "El número de destino no está registrado en WhatsApp.",
              )
            }
            await client.sendMessage(chatId, message)
          } catch (error) {
            await logRef.update({
              status: "failed",
              error: safeErrorMessage(error),
              failedAt: FieldValue.serverTimestamp(),
            }).catch((logError) => {
              console.error("No se pudo registrar el fallo de WhatsApp:", logError)
            })
            throw error
          }

          await markProcessed(key)
          await logRef.update({
            status: "sent",
            acceptedAt: FieldValue.serverTimestamp(),
          }).catch((error) => {
            console.error("WhatsApp aceptó el mensaje, pero no se pudo actualizar su bitácora:", error)
          })

          console.log(
            `Se envió la notificación "${stage}" para la cita ${appointmentId}.`,
          )
        } catch (error) {
          console.error(
            `No se pudo enviar WhatsApp para la cita ${appointmentId}:`,
            error,
          )

          pendingNotifications.set(key, notification)

          if (
            error instanceof Error &&
            /detached frame|target closed|session closed|execution context was destroyed/i.test(
              error.message,
            )
          )
            void recoverWhatsAppClient(error)

          scheduleRetry()

          break
        }
      }
    } finally {
      dispatching = false
    }
  }

  function processAppointmentSnapshot(document) {
    const appointment = document.data()
    const previous = knownAppointments.get(document.id)

    if (!previous) {
      enqueueNotification(
        document.id,
        appointment.status === "confirmed" ? "confirmed" : "received",
        appointment,
      )
    } else {
      if (previous.status === "pending" && appointment.status === "confirmed")
        enqueueNotification(document.id, "confirmed", appointment)
    }

    knownAppointments.set(document.id, {
      ...appointment,
      payments: Array.isArray(appointment.payments)
        ? appointment.payments.map((payment) => ({ ...payment }))
        : [],
    })
  }

  async function checkUpcomingReminders() {
    if (reminderSweepInProgress || !appointments) return

    reminderSweepInProgress = true

    try {
      const snapshot = await appointments.get()

      const now = Date.now()

      for (const document of snapshot.docs) {
        processAppointmentSnapshot(document)

        const appointment = document.data()

        if (appointment.status !== "confirmed") continue

        const timeZone = process.env.BUSINESS_TIME_ZONE ?? "America/Mexico_City"

        const appointmentAt = appointmentTimestamp(appointment, timeZone)

        if (!appointmentAt) {
          console.error(
            `No se pudo calcular el recordatorio para la cita ${document.id}: fecha u hora inválida.`,
          )

          continue
        }

        if (
          isAppointmentReminderDue(appointment, now, timeZone, reminderHours)
        ) {
          enqueueNotification(document.id, "reminder", appointment)
        }
      }
    } catch (error) {
      console.error(
        "No se pudieron revisar las citas para sus recordatorios:",
        error,
      )
    } finally {
      reminderSweepInProgress = false
    }
  }

  async function startFirestoreListener() {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      "loto-19em"

    if (!projectId)
      throw new Error("Configura FIREBASE_PROJECT_ID en whatsapp-service/.env.")

    const app =
      getApps().find((item) => item.name === "loto-whatsapp") ??
      initializeApp(
        {
          credential: applicationDefault(),

          projectId,
        },
        "loto-whatsapp",
      )

    firestore = getFirestore(app)

    adminAuth = getAuth(app)

    appointments = firestore.collection("appointments")
    stopSettingsListening = listenWithRecovery(
      "settings/general",
      (onSnapshot, onError) =>
        firestore
          .collection("settings")
          .doc("general")
          .onSnapshot(onSnapshot, onError),
      (snapshot) => {
        const generalSettings = snapshot.data() ?? {}
        const automation = generalSettings.whatsappAutomations ?? {}
        automationSettings = {
          enabled: automation.enabled ?? {},
          templates: automation.templateVersion === 2 ? automation.templates ?? {} : {},
          templateVersion: automation.templateVersion,
          adminPhones: {
            main: generalSettings.whatsapp ?? generalSettings.phone ?? "",
            north:
              generalSettings.secondaryBranch?.whatsapp ??
              generalSettings.secondaryBranch?.phone ??
              "",
          },
        }
        const configuredHours = Number(
          automation.reminderHours ?? generalSettings.reminderHours,
        )
        if (
          Number.isFinite(configuredHours) &&
          configuredHours > 0 &&
          configuredHours <= 168
        )
          reminderHours = configuredHours
      },
    )

    console.log("Conectando con Firestore...")

    const hasCheckpoint = await loadCheckpoint()

    let currentSnapshot
    let retryDelay = 1_000

    while (!stopping && !currentSnapshot) {
      try {
        currentSnapshot = await appointments.get()
      } catch (error) {
        console.error("No se pudieron cargar las citas de Firestore:", error)
        console.error(
          `Se volverán a cargar las citas en ${retryDelay / 1000} s.`,
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        retryDelay = Math.min(retryDelay * 2, 60_000)
      }
    }

    if (stopping || !currentSnapshot) return

    currentSnapshot.docs.forEach((snapshot) => {
      const appointment = snapshot.data()
      knownAppointments.set(snapshot.id, appointment)
    })

    if (!hasCheckpoint) {
      currentSnapshot.docs.forEach((snapshot) => processedIds.add(snapshot.id))

      await saveCheckpoint()

      console.log(
        `Primer inicio: se omiten ${currentSnapshot.size} citas existentes; se avisará sobre las nuevas.`,
      )
    } else {
      for (const snapshot of currentSnapshot.docs) {
        if (!processedIds.has(snapshot.id))
          enqueueNotification(snapshot.id, "received", snapshot.data())
      }
    }

    stopListening = listenWithRecovery(
      "appointments",
      (onSnapshot, onError) => appointments.onSnapshot(onSnapshot, onError),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          processAppointmentSnapshot(change.doc)
        }
      },
    )

    void checkUpcomingReminders()

    reminderTimer = setInterval(() => void checkUpcomingReminders(), 60_000)

    console.log("Escuchando nuevas citas pendientes en Firestore.")
  }

  async function start() {
    if (startPromise) return startPromise

    status.state = "starting"

    status.message = "Iniciando WhatsApp y Firestore…"

    const whatsappStart = client.initialize().catch(async (error) => {
      status.state = "error"

      status.qr = null

      status.message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el servicio de WhatsApp."

      console.error("No se pudo iniciar el servicio de WhatsApp:", error)

      await client.destroy().catch((cleanupError) => {
        console.error(
          "No se pudo cerrar el navegador de WhatsApp:",
          cleanupError,
        )
      })

      scheduleWhatsAppRecovery(error)
    })

    startPromise = Promise.all([
      whatsappStart,

      startFirestoreListener(),
    ]).catch(async (error) => {
      status.state = "error"

      status.qr = null

      status.message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el servicio de WhatsApp."

      console.error("No se pudo iniciar el servicio de WhatsApp:", error)

      stopListening()
      stopSettingsListening()
    })

    return startPromise
  }

  async function getNotificationHistory() {
    if (!firestore) throw new Error("Firestore todavía no está conectado.")
    const snapshot = await firestore
      .collection("whatsappMessageLog")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
    return snapshot.docs.map((document) => {
      const entry = document.data()
      return {
        id: document.id,
        appointmentId: entry.appointmentId ?? "",
        branchId: entry.branchId === "north" ? "north" : "main",
        stage: entry.stage ?? "",
        status: entry.status ?? "pending",
        recipientMasked: entry.recipientMasked ?? "",
        error: entry.error ?? "",
        createdAt: entry.createdAt?.toDate?.().toISOString() ?? null,
        acceptedAt: entry.acceptedAt?.toDate?.().toISOString() ?? null,
        failedAt: entry.failedAt?.toDate?.().toISOString() ?? null,
      }
    })
  }

  async function sendManualReminder(appointmentId) {
    if (!whatsappReady) {
      const error = new Error("WhatsApp no está conectado.")
      error.statusCode = 503
      throw error
    }
    if (typeof appointmentId !== "string" || !appointmentId.trim()) {
      const error = new Error("La cita indicada no es válida.")
      error.statusCode = 400
      throw error
    }

    const snapshot = await appointments.doc(appointmentId).get()
    if (!snapshot.exists) {
      const error = new Error("No se encontró la cita.")
      error.statusCode = 404
      throw error
    }

    const appointment = snapshot.data()
    if (appointment.status !== "confirmed") {
      const error = new Error("Solo se pueden enviar recordatorios de citas confirmadas.")
      error.statusCode = 400
      throw error
    }
    const recipient = notificationRecipient("reminder", appointment)
    if (!recipient) {
      const error = new Error("La cita no tiene un teléfono válido para WhatsApp.")
      error.statusCode = 400
      throw error
    }

    const logRef = firestore.collection("whatsappMessageLog").doc(randomUUID())
    await logRef.set({
      appointmentId,
      branchId: appointment.branchId ?? "main",
      stage: "reminder",
      status: "pending",
      manual: true,
      attempts: 1,
      recipientMasked: maskedPhone(appointment.clientPhone),
      createdAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
    })

    try {
      const registeredId = await client.getNumberId(recipient.replace(/@c\.us$/, ""))
      const chatId = serializeWhatsAppId(registeredId)
      if (!chatId) {
        throw new Error("El número de destino no está registrado en WhatsApp.")
      }
      await client.sendMessage(chatId, notificationMessage("reminder", appointment))
      await logRef.update({
        status: "sent",
        acceptedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      await logRef.update({
        status: "failed",
        error: safeErrorMessage(error),
        failedAt: FieldValue.serverTimestamp(),
      }).catch((logError) => {
        console.error("No se pudo registrar el fallo del recordatorio manual:", logError)
      })
      throw error
    }
  }

  async function authorizeAdmin(idToken) {
    let decodedToken

    try {
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch {
      const error = new Error(
        "Inicia sesión como administrador para ver el QR de WhatsApp.",
      )

      error.statusCode = 401

      throw error
    }

    if (decodedToken.firebase?.sign_in_provider === "anonymous") {
      const error = new Error(
        "Solo una cuenta de administrador puede ver el QR de WhatsApp.",
      )

      error.statusCode = 403

      throw error
    }

    const profile = await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .get()

    let role = profile.exists ? profile.data()?.role : undefined

    if (!role) {
      const legacyProfile = await firestore
        .collection("user")
        .doc(decodedToken.uid)
        .get()

      role = legacyProfile.exists ? legacyProfile.data()?.role : undefined
    }

    if (role !== "admin") {
      const error = new Error(
        "Solo una cuenta de administrador puede ver el QR de WhatsApp.",
      )

      error.statusCode = 403

      throw error
    }
  }

  function onQr(qr) {
    status.state = "pairing"

    status.message =
      "Escanea el código QR con WhatsApp > Dispositivos vinculados."

    status.qr = qr
  }

  function scheduleWhatsAppRecovery(reason) {
    if (stopping || whatsappRecoveryPromise || whatsappRecoveryTimer) return

    whatsappReady = false
    status.state = "starting"
    status.qr = null
    status.message = "Reconectando WhatsApp automáticamente…"

    const delay = Math.min(5_000 * 2 ** whatsappRetryCount, 60_000)
    whatsappRetryCount += 1

    console.error(
      `Se reiniciará la conexión de WhatsApp en ${delay / 1000} s:`,
      reason,
    )

    whatsappRecoveryTimer = setTimeout(() => {
      whatsappRecoveryTimer = undefined
      void recoverWhatsAppClient(reason)
    }, delay)
  }

  async function recoverWhatsAppClient(reason) {
    if (stopping || whatsappRecoveryPromise) return whatsappRecoveryPromise

    whatsappReady = false
    status.state = "starting"
    status.qr = null
    status.message = "Reconectando WhatsApp automáticamente…"

    const previousClient = client
    let recoveryError

    whatsappRecoveryPromise = (async () => {
      await previousClient.destroy().catch((error) => {
        console.error(
          "No se pudo cerrar la conexión anterior de WhatsApp:",
          error,
        )
      })

      if (stopping) return

      await waitForSessionRelease()

      if (String(reason).includes("LOGOUT")) await clearWhatsAppSession()

      client = createWhatsAppClient()
      attachWhatsAppClientEvents(client)
      await client.initialize()
    })()
      .catch((error) => {
        recoveryError = error
        console.error("No se pudo reiniciar WhatsApp:", reason, error)
        status.state = "disconnected"
        status.message =
          "No se pudo reconectar WhatsApp; se volverá a intentar."
      })
      .finally(() => {
        whatsappRecoveryPromise = undefined

        if (recoveryError) scheduleWhatsAppRecovery(recoveryError)
      })

    return whatsappRecoveryPromise
  }

  function attachWhatsAppClientEvents(whatsappClient) {
    whatsappClient.on("qr", (qr) => {
      if (whatsappClient === client) onQr(qr)
    })

    whatsappClient.on("ready", () => {
      if (whatsappClient !== client) return

      if (stopping) return

      if (stopping) return

      status.state = "connected"
      status.qr = null
      status.message =
        "WhatsApp conectado. Los mensajes y recordatorios están activos."
      whatsappReady = true
      whatsappRetryCount = 0

      if (whatsappRecoveryTimer) clearTimeout(whatsappRecoveryTimer)
      whatsappRecoveryTimer = undefined

      console.log(status.message)
      void dispatchPendingNotifications()
      void checkUpcomingReminders()
    })

    whatsappClient.on("auth_failure", (message) => {
      if (whatsappClient !== client) return

      whatsappReady = false
      status.state = "error"
      status.qr = null
      status.message = `Falló la autenticación de WhatsApp: ${message}`
      console.error(status.message)
      scheduleWhatsAppRecovery(new Error(status.message))
    })

    whatsappClient.on("disconnected", (reason) => {
      if (whatsappClient !== client) return

      whatsappReady = false
      status.state = "disconnected"
      status.qr = null
      status.message = `WhatsApp se desconectó: ${reason}`
      console.error(status.message)
      scheduleWhatsAppRecovery(new Error(status.message))
    })
  }

  attachWhatsAppClientEvents(client)

  return {
    start,

    getStatus: () => ({ ...status }),

    authorizeAdmin,
    getNotificationHistory,
    sendManualReminder,

    async stop() {
      stopping = true
      whatsappReady = false

      if (retryTimer) clearTimeout(retryTimer)

      if (whatsappRecoveryTimer) clearTimeout(whatsappRecoveryTimer)

      if (reminderTimer) clearInterval(reminderTimer)

      stopListening()
      stopSettingsListening()

      await client.destroy().catch((error) => {
        console.error("No se pudo cerrar la conexión de WhatsApp:", error)
      })
    },
  }
}
