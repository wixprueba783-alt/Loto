import dotenv from "dotenv"

import { mkdir, readFile, rename, writeFile } from "node:fs/promises"

import path from "node:path"

import { fileURLToPath } from "node:url"

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app"

import { getAuth } from "firebase-admin/auth"

import { getFirestore } from "firebase-admin/firestore"

import whatsappWeb from "whatsapp-web.js"

import {
  appointmentConfirmedMessage,
  appointmentReceivedMessage,
  appointmentReminderMessage,
  appointmentTimestamp,
  isAppointmentReminderDue,
  normalizePhone,
} from "./notifications.js"

const { Client, LocalAuth } = whatsappWeb

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

export function createWhatsAppService() {
  const status = {
    state: "starting",

    qr: null,

    message: "Iniciando conexión con WhatsApp…",
  }

  const processedIds = new Set()

  const pendingNotifications = new Map()

  const knownStatuses = new Map()

  const client = new Client({
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
      headless: true,

      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },

    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  })

  let firestore

  let adminAuth

  let appointments

  let whatsappReady = false

  let dispatching = false

  let reminderSweepInProgress = false

  let reminderHours = 24

  let stopListening = () => {}

  let stopSettingsListening = () => {}

  let retryTimer

  let reminderTimer

  let startPromise

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

    if (stage === "manual-reminder")
      return `manual-reminder:${id}:${appointment.requestId}`

    return `reminder:${id}:${appointment.date}:${appointment.time}`
  }

  function enqueueNotification(id, stage, appointment) {
    const key = notificationKey(id, stage, appointment)

    if (processedIds.has(key) || pendingNotifications.has(key)) return

    pendingNotifications.set(key, {
      id,

      stage,

      date: appointment.date,

      time: appointment.time,

      requestId: appointment.requestId,
    })

    void dispatchPendingNotifications()
  }

  async function installChatResolutionFallback() {
    await client.pupPage.evaluate(() => {
      const originalGetChat = window.WWebJS.getChat

      window.WWebJS.getChat = async (chatId, { getAsModel = true } = {}) => {
        const isChannel = /@\w*newsletter\b/.test(chatId)

        if (isChannel) return originalGetChat(chatId, { getAsModel })

        const widFactory = window.require("WAWebWidFactory")

        const chatWid = widFactory.createWid(chatId)

        const findOrCreateLatestChat = (id) =>
          window

            .require("WAWebFindChatAction")

            .findOrCreateLatestChat(id)

        let chat = window.require("WAWebCollections").Chat.get(chatWid)

        if (!chat) {
          try {
            chat = (await findOrCreateLatestChat(chatWid))?.chat
          } catch {
            chat = undefined
          }
        }

        if (!chat) {
          const query = window
            .require("WAWebContactSyncUtils")
            .constructUsyncDeltaQuery([
              {
                type: "add",

                phoneNumber: chatWid.user,
              },
            ])

          const result = await query.execute()

          const entry = result?.list?.[0]

          const id = entry?.id

          const serializedId =
            typeof id === "string"
              ? id
              : typeof id?._serialized === "string"
                ? id._serialized
                : id?.server === "lid" && id?.user
                  ? `${id.user}@lid`
                  : null

          const lid = serializedId?.endsWith("@lid") ? serializedId : null

          if (!lid) {
            const diagnostic = {
              resultKeys:
                result && typeof result === "object" ? Object.keys(result) : [],

              resultListLength: Array.isArray(result?.list)
                ? result.list.length
                : null,

              firstEntryKeys:
                entry && typeof entry === "object" ? Object.keys(entry) : [],

              firstEntryTypes:
                entry && typeof entry === "object"
                  ? Object.fromEntries(
                      Object.entries(entry).map(([key, value]) => [
                        key,
                        typeof value,
                      ]),
                    )
                  : null,

              idKeys: id && typeof id === "object" ? Object.keys(id) : [],

              idServer: typeof id?.server === "string" ? id.server : null,

              hasSerializedLid:
                typeof id?._serialized === "string" &&
                id._serialized.endsWith("@lid"),
            }

            throw new Error(
              `No se pudo extraer un identificador LID. Diagnóstico sin datos personales: ${JSON.stringify(diagnostic)}`,
            )
          }

          const lidWid = widFactory.createWid(lid)

          chat = (await findOrCreateLatestChat(lidWid))?.chat
        }

        return getAsModel && chat
          ? await window.WWebJS.getChatModel(chat, { isChannel: false })
          : chat
      }
    })
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
          const latestSnapshot = await appointments.doc(appointmentId).get()

          if (!latestSnapshot.exists) {
            await markProcessed(key)

            continue
          }

          const appointment = latestSnapshot.data()

          if (
            (stage === "received" || stage === "manual-reminder") &&
            appointment.status === "cancelled"
          ) {
            await markProcessed(key)

            continue
          }

          if (stage !== "received" && appointment.status !== "confirmed")
            continue

          if (
            stage === "manual-reminder" &&
            appointment.manualReminderRequest?.id !== notification.requestId
          )
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

          const recipient = normalizePhone(appointment.clientPhone)

          if (!recipient) {
            console.error(
              `No se envió WhatsApp a la cita ${appointmentId}: el teléfono no es válido.`,
            )

            await markProcessed(key)

            continue
          }

          const message =
            stage === "received"
              ? appointmentReceivedMessage(appointment)
              : stage === "confirmed"
                ? appointmentConfirmedMessage(appointment)
                : appointmentReminderMessage(appointment)

          await client.sendMessage(recipient, message)

          await markProcessed(key)

          console.log(
            `Se envió la notificación "${stage}" para la cita ${appointmentId}.`,
          )
        } catch (error) {
          console.error(
            `No se pudo enviar WhatsApp para la cita ${appointmentId}:`,
            error,
          )

          pendingNotifications.set(key, notification)

          scheduleRetry()

          break
        }
      }
    } finally {
      dispatching = false
    }
  }

  async function checkUpcomingReminders() {
    if (reminderSweepInProgress || !appointments) return

    reminderSweepInProgress = true

    try {
      const snapshot = await appointments
        .where("status", "==", "confirmed")
        .get()

      const now = Date.now()

      for (const document of snapshot.docs) {
        const appointment = document.data()

        const timeZone = process.env.BUSINESS_TIME_ZONE ?? "America/Mexico_City"

        const appointmentAt = appointmentTimestamp(appointment, timeZone)

        if (!appointmentAt) {
          console.error(
            `No se pudo calcular el recordatorio para la cita ${document.id}: fecha u hora inválida.`,
          )

          continue
        }

        if (
          isAppointmentReminderDue(
            appointment,
            now,
            timeZone,
            reminderHours,
          )
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
    const projectId = process.env.FIREBASE_PROJECT_ID

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
    stopSettingsListening = firestore
      .collection("settings")
      .doc("general")
      .onSnapshot(
        (snapshot) => {
          const configuredHours = Number(snapshot.data()?.reminderHours)
          if (
            Number.isFinite(configuredHours) &&
            configuredHours > 0 &&
            configuredHours <= 168
          )
            reminderHours = configuredHours
        },
        (error) => {
          console.error(
            "No se pudo escuchar la configuración de recordatorios:",
            error,
          )
        },
      )

    console.log("Conectando con Firestore...")

    const hasCheckpoint = await loadCheckpoint()

    const currentSnapshot = await appointments.get()

    currentSnapshot.docs.forEach((snapshot) => {
      const appointment = snapshot.data()

      knownStatuses.set(snapshot.id, appointment.status)

      if (appointment.manualReminderRequest?.id) {
        enqueueNotification(snapshot.id, "manual-reminder", {
          ...appointment,

          requestId: appointment.manualReminderRequest.id,
        })
      }
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

    stopListening = appointments.onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const appointment = change.doc.data()

          const previousStatus = knownStatuses.get(change.doc.id)

          const requestId = appointment.manualReminderRequest?.id

          if (change.type === "added") {
            enqueueNotification(
              change.doc.id,
              appointment.status === "confirmed" ? "confirmed" : "received",
              appointment,
            )
          } else if (
            previousStatus === "pending" &&
            appointment.status === "confirmed"
          ) {
            enqueueNotification(change.doc.id, "confirmed", appointment)
          }

          if (requestId) {
            enqueueNotification(change.doc.id, "manual-reminder", {
              ...appointment,

              requestId,
            })
          }

          knownStatuses.set(change.doc.id, appointment.status)
        }
      },
      (error) => {
        console.error(
          "No se pudo escuchar la colección appointments de Firestore:",
          error,
        )
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

    startPromise = Promise.all([
      client.initialize(),

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

      await client.destroy().catch((cleanupError) => {
        console.error(
          "No se pudo cerrar el navegador de WhatsApp:",
          cleanupError,
        )
      })
    })

    return startPromise
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

  client.on("qr", onQr)

  client.on("ready", () => {
    void installChatResolutionFallback()
      .then(() => {
        status.state = "connected"

        status.qr = null

        status.message =
          "WhatsApp conectado. Los mensajes y recordatorios están activos."

        whatsappReady = true

        console.log(status.message)

        void dispatchPendingNotifications()

        void checkUpcomingReminders()
      })
      .catch((error) => {
        status.state = "error"

        status.message = "No se pudo preparar la conexión de WhatsApp."

        whatsappReady = false

        console.error(status.message, error)
      })
  })

  client.on("auth_failure", (message) => {
    whatsappReady = false

    status.state = "error"

    status.qr = null

    status.message = `Falló la autenticación de WhatsApp: ${message}`

    console.error(status.message)
  })

  client.on("disconnected", (reason) => {
    whatsappReady = false

    status.state = "disconnected"

    status.qr = null

    status.message = `WhatsApp se desconectó: ${reason}`

    console.error(status.message)
  })

  return {
    start,

    getStatus: () => ({ ...status }),

    authorizeAdmin,

    async stop() {
      whatsappReady = false

      if (retryTimer) clearTimeout(retryTimer)

      if (reminderTimer) clearInterval(reminderTimer)

      stopListening()
      stopSettingsListening()

      await client.destroy().catch((error) => {
        console.error("No se pudo cerrar la conexión de WhatsApp:", error)
      })
    },
  }
}
