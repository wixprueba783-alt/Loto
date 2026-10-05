import { auth, db, authReady, firebaseConfigured, storage } from "./firebase"
import {
  collection,
  getDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore"
import type { DocumentData } from "firebase/firestore"
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage"
import type {
  Service,
  ServiceSubservice,
  Appointment,
  BlockedDay,
  BlockedTime,
  GalleryPhoto,
  BusinessSettings,
  BranchId,
  PaymentStatus,
} from "./types"
import type { Role, User } from "./types"

/* ============================================================
   Datos que vienen de Firestore.
   Estos arreglos empiezan vacíos y se llenan con initFirestoreData(),
   que App.tsx llama una sola vez al arrancar la app. El resto de las
   páginas los usan exactamente igual que antes (import { SERVICES } ...),
   solo que ahora su contenido viene de la base de datos real.
   ============================================================ */

export let SERVICES: Service[] = []
export let SERVICE_SUBSERVICES: ServiceSubservice[] = []
export let APPOINTMENTS: Appointment[] = []
export let GALLERY_PHOTOS: GalleryPhoto[] = []
export let BLOCKED_DAYS: BlockedDay[] = []
export let BLOCKED_TIMES: BlockedTime[] = []
export interface BusySlot extends DocumentData {
  date: string
  time: string
  duration: number
  appointmentId: string
  appointmentIds?: string[]
  branchId?: BranchId
}
export let BUSY_SLOTS: BusySlot[] = []

export const DEFAULT_SERVICE_CATEGORIES = [
  "Manicura",
  "Gel",
  "Acrílico",
  "Arte",
  "Retiro",
  "Pedicura",
]

export let BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "Loto",
  tagline: "Tu belleza, nuestra pasión",
  phone: "555-100-2000",
  email: "admin@nailstudio.mx",
  address: "Av. Reforma 1234, Col. Centro, CDMX",
  instagram: "@nailstudio.mx",
  facebook: "facebook.com/nailstudio",
  whatsapp: "5551002000",
  latitude: "",
  longitude: "",
  categories: [...DEFAULT_SERVICE_CATEGORIES],
  autoConfirm: false,
  reminderEmail: true,
  reminderHours: "24",
  maxDailyAppts: "10",
  appointmentDuration: "60",
  secondaryBranch: {
    businessName: "Loto Sucursal Norte",
    tagline: "Tu belleza, nuestra pasión",
    phone: "555-100-2000",
    email: "admin@nailstudio.mx",
    address: "",
    instagram: "@nailstudio.mx",
    facebook: "facebook.com/nailstudio",
    whatsapp: "5551002000",
    latitude: "",
    longitude: "",
  },
}
export let SERVICE_CATEGORIES = [...DEFAULT_SERVICE_CATEGORIES]

export async function syncServiceCategories(categories: string[]) {
  const cleaned = Array.from(
    new Set(categories.map((c) => c.trim()).filter(Boolean)),
  )
  const nextCategories =
    cleaned.length > 0 ? cleaned : [...DEFAULT_SERVICE_CATEGORIES]
  const nextSettings = { ...BUSINESS_SETTINGS, categories: nextCategories }

  if (firebaseConfigured) {
    await setDoc(doc(db, "settings", "general"), nextSettings, {
      merge: true,
    }).catch((err) => {
      console.error("No se pudo guardar las categorías en Firestore:", err)
      throw err
    })
  }

  SERVICE_CATEGORIES = nextCategories
  BUSINESS_SETTINGS = nextSettings
}

function branchDocumentId(id: string, branchId: BranchId) {
  return branchId === "main" ? id : `north_${id}`
}

function documentBranchId(id: string, data: { branchId?: BranchId }): BranchId {
  return data.branchId ?? (id.startsWith("north_") ? "north" : "main")
}

export let dataReady = false

export async function getUserProfile(uid: string): Promise<User | null> {
  const usersSnapshot = await getDoc(doc(db, "users", uid))
  if (usersSnapshot.exists()) return { uid, ...usersSnapshot.data() } as User

  // Compatibilidad con el perfil creado anteriormente en la colección singular.
  const legacySnapshot = await getDoc(doc(db, "user", uid))
  return legacySnapshot.exists()
    ? { uid, ...legacySnapshot.data() } as User
    : null
}

export async function saveUserProfile(uid: string, profile: Omit<User, "uid">) {
  await setDoc(doc(db, "users", uid), profile, { merge: true })
}

export async function updateManagedUser(
  uid: string,
  profile: Partial<Omit<User, "uid">>,
) {
  await setDoc(doc(db, "users", uid), profile, { merge: true })
}

export async function deleteManagedUser(uid: string) {
  await deleteDoc(doc(db, "users", uid))
}

export async function getWorkers() {
  const snapshot = await getDocs(
    query(collection(db, "users"), where("role", "==", "worker")),
  )
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as User)
}

export async function getUsers() {
  const [usersSnapshot, legacySnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "user")),
  ])
  const profiles = [...usersSnapshot.docs, ...legacySnapshot.docs].map(
    (item) => ({ uid: item.id, ...item.data() }) as User,
  )
  return Array.from(
    new Map(profiles.map((profile) => [profile.uid, profile])).values(),
  )
}

export function subscribeAdminAppointments(onChange: () => void) {
  return onSnapshot(
    collection(db, "appointments"),
    (snapshot) => {
      APPOINTMENTS = snapshot.docs.map(
        (item) =>
          ({ id: item.id, branchId: "main", ...item.data() }) as Appointment,
      )
      onChange()
    },
    (error) =>
      console.error(
        "No se pudieron leer las citas para el administrador:",
        error,
      ),
  )
}

export async function loadAdminAppointments() {
  const snapshot = await getDocs(collection(db, "appointments"))
  APPOINTMENTS = snapshot.docs.map(
    (item) =>
      ({ id: item.id, branchId: "main", ...item.data() }) as Appointment,
  )
  return APPOINTMENTS
}

export function currentUserUid() {
  return auth.currentUser?.uid
}

export function currentUserRole(): Role {
  return auth.currentUser?.isAnonymous ? "guest" : "client"
}

export function getAppointmentPaymentSummary(
  appointment: Appointment,
): {
  status: PaymentStatus
  paid: number
  due: number
  payments: Appointment["payments"]
} {
  const total = Math.max(0, Number(appointment.total) || 0)
  const recordedPayments = appointment.payments ?? []
  const recordedTotal = recordedPayments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.amount) || 0),
    0,
  )

  if (appointment.status === "cancelled") {
    return { status: "cancelled", paid: 0, due: 0, payments: [] }
  }

  const isLegacyUnpaidFullAmount =
    appointment.status !== "completed" && total > 0 && recordedTotal >= total
  const payments = isLegacyUnpaidFullAmount ? [] : recordedPayments
  const paymentsTotal = payments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.amount) || 0),
    0,
  )
  const paid =
    appointment.status === "completed"
      ? Math.min(total, paymentsTotal || total)
      : Math.min(total, paymentsTotal)
  const due = Math.max(0, total - paid)
  const status: PaymentStatus =
    due === 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "pending"

  return { status, paid, due, payments }
}

function appointmentDuration(appointment: Appointment) {
  return Math.max(
    1,
    appointment.duration ??
      appointment.services?.reduce(
        (sum, service) => sum + service.duration,
        0,
      ) ??
      appointment.service.duration,
  )
}

function applySnapshotData(
  collectionName: string,
  docs: { id: string data: () => DocumentData }[],
) {
  if (collectionName === "services")
    SERVICES = docs.map((d) => ({ id: d.id, ...d.data() }) as Service)
  if (collectionName === "serviceSubservices")
    SERVICE_SUBSERVICES = docs.map(
      (d) => ({ id: d.id, ...d.data() }) as ServiceSubservice,
    )
  if (collectionName === "appointments")
    APPOINTMENTS = docs.map(
      (d) => ({ id: d.id, branchId: "main", ...d.data() }) as Appointment,
    )
  if (collectionName === "galleryPhotos")
    GALLERY_PHOTOS = docs.map(
      (d) => ({ id: d.id, ...d.data() }) as GalleryPhoto,
    )
  if (collectionName === "blockedDays")
    BLOCKED_DAYS = docs.map((d) => {
      const data = d.data() as BlockedDay
      return { ...data, branchId: documentBranchId(d.id, data) }
    })
  if (collectionName === "blockedTimes")
    BLOCKED_TIMES = docs.map((d) => {
      const data = d.data() as BlockedTime
      return { ...data, branchId: documentBranchId(d.id, data) }
    })
  if (collectionName === "availability")
    AVAILABILITY = docs.map((d) => {
      const data = d.data() as Availability
      return { ...data, branchId: documentBranchId(d.id, data) }
    })
  if (collectionName === "busySlots")
    BUSY_SLOTS = docs.map((d) => {
      const data = d.data() as BusySlot
      return { ...data, branchId: documentBranchId(d.id, data) }
    })
}

export async function subscribeFirestoreData(
  onChange: () => void,
): Promise<() => void> {
  if (!firebaseConfigured) return () => {}

  const profile =
    auth.currentUser && !auth.currentUser.isAnonymous
      ? await getUserProfile(auth.currentUser.uid)
      : null
  const appointmentSource =
    auth.currentUser &&
    (profile?.role === "admin"
      ? collection(db, "appointments")
      : query(
          collection(db, "appointments"),
          where(
            profile?.role === "worker" ? "workerUid" : "ownerUid",
            "==",
            auth.currentUser.uid,
          ),
        ))

  const unsubscribers = [
    "services",
    "serviceSubservices",
    "galleryPhotos",
    "blockedDays",
    "blockedTimes",
    "availability",
    "busySlots",
  ].map((collectionName) =>
    onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        applySnapshotData(collectionName, snapshot.docs)
        onChange()
      },
      (error) => {
        if (collectionName === "busySlots") {
          console.warn(
            "Publica firestore.rules en el proyecto activo para compartir los horarios reservados:",
            error,
          )
          return
        }
        console.error(
          `No se pudo sincronizar ${collectionName} desde Firestore:`,
          error,
        )
      },
    ),
  )
  if (appointmentSource) {
    unsubscribers.push(
      onSnapshot(appointmentSource, (snapshot) => {
        applySnapshotData("appointments", snapshot.docs)
        onChange()
      }),
    )
  }

  const settingsUnsubscribe = onSnapshot(
    doc(db, "settings", "general"),
    (snapshot) => {
      if (snapshot.exists()) {
        BUSINESS_SETTINGS = {
          ...BUSINESS_SETTINGS,
          ...snapshot.data() as Partial<BusinessSettings>,
        }
        SERVICE_CATEGORIES =
          BUSINESS_SETTINGS.categories &&
          BUSINESS_SETTINGS.categories.length > 0
            ? BUSINESS_SETTINGS.categories
            : [...DEFAULT_SERVICE_CATEGORIES]
      }
      onChange()
    },
  )

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    settingsUnsubscribe()
  }
}

async function backfillBusySlots(appointments: Appointment[]) {
  const existingSnapshot = await getDocs(collection(db, "busySlots"))
  const desiredSlots = new Map<string, BusySlot>()
  appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .forEach((appointment) => {
      const duration = appointmentDuration(appointment)
      const blocks = Math.ceil(duration / 60)
      const startMinutes = toMinutes(appointment.time)
      Array.from({ length: blocks }, (_, slotIndex) =>
        toTime(startMinutes + slotIndex * 60),
      ).forEach((time) => {
        const branchId = appointment.branchId ?? "main"
        const id = makeBusySlotId(appointment.date, time, branchId)
        const existing = desiredSlots.get(id)
        const appointmentIds = Array.from(
          new Set([...(existing?.appointmentIds ?? []), appointment.id]),
        )
        desiredSlots.set(id, {
          date: appointment.date,
          time,
          duration: existing?.duration ?? duration,
          appointmentId: existing?.appointmentId ?? appointment.id,
          appointmentIds,
          branchId,
        })
      })
    })

  const existingById = new Map(
    existingSnapshot.docs
      .filter((snapshot) => !snapshot.id.startsWith("north_"))
      .map((snapshot) => [snapshot.id, snapshot]),
  )
  const operations: Array<{
    type: "set" | "update" | "delete"
    id: string
    data?: BusySlot
  }> = []
  desiredSlots.forEach((slot, id) => {
    const existing = existingById.get(id)
    if (!existing) operations.push({ type: "set", id, data: slot })
    else {
      const existingSlot = existing.data() as BusySlot
      const existingAppointmentIds = existingSlot.appointmentIds ?? [
        existingSlot.appointmentId,
      ]
      if (existingAppointmentIds.join("|") !== slot.appointmentIds?.join("|")) {
        operations.push({ type: "update", id, data: slot })
      }
      existingById.delete(id)
    }
  })
  existingById.forEach((_, id) => operations.push({ type: "delete", id }))

  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db)
    operations.slice(offset, offset + 450).forEach((operation) => {
      const reference = doc(db, "busySlots", operation.id)
      if (operation.type === "delete") batch.delete(reference)
      else if (operation.type === "update")
        batch.update(reference, operation.data!)
      else batch.set(reference, operation.data!)
    })
    await batch.commit()
  }
  BUSY_SLOTS = [
    ...BUSY_SLOTS.filter((slot) => slot.branchId === "north"),
    ...desiredSlots.values(),
  ]
}

export async function initFirestoreData() {
  if (!firebaseConfigured) {
    throw new Error("Faltan las variables VITE_FIREBASE_* en el archivo .env")
  }

  await authReady // espera a que exista una sesión (anónima) antes de leer/escribir

  const profile =
    auth.currentUser && !auth.currentUser.isAnonymous
      ? await getUserProfile(auth.currentUser.uid)
      : null
  const appointmentSource =
    auth.currentUser &&
    (profile?.role === "admin"
      ? collection(db, "appointments")
      : query(
          collection(db, "appointments"),
          where(
            profile?.role === "worker" ? "workerUid" : "ownerUid",
            "==",
            auth.currentUser.uid,
          ),
        ))

  const reads = Promise.all([
    getDocs(collection(db, "services")),
    getDocs(collection(db, "serviceSubservices")).catch((error) => {
      console.error(
        "No se pudieron leer los servicios especializados; verifica las reglas de Firestore:",
        error,
      )
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "permission-denied"
      ) {
        throw new Error(
          "Firestore denegó el acceso a serviceSubservices. Publica la regla de lectura de esa colección.",
        )
      }
      throw error
    }),
    appointmentSource
      ? getDocs(appointmentSource)
      : Promise.resolve({ docs: [] } as never),
    getDocs(collection(db, "galleryPhotos")),
    getDocs(collection(db, "blockedDays")),
    getDocs(collection(db, "blockedTimes")),
    getDocs(collection(db, "availability")),
    getDocs(collection(db, "busySlots")).catch((error) => {
      console.warn(
        "No se pudieron leer los bloqueos de horario; verifica firestore.rules:",
        error,
      )
      return null
    }),
    getDocs(collection(db, "settings")),
  ])
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(
      () => reject(new Error("La conexión con Firebase tardó demasiado")),
      3000,
    )
  })
  const [
    servicesSnap,
    serviceSubservicesSnap,
    apptsSnap,
    gallerySnap,
    blockedDaysSnap,
    blockedTimesSnap,
    availabilitySnap,
    busySlotsSnap,
    settingsSnap,
  ] = await Promise.race([reads, timeout])

  SERVICES = servicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Service,
  )
  SERVICE_SUBSERVICES = serviceSubservicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ServiceSubservice,
  )
  APPOINTMENTS = apptsSnap.docs.map(
    (d) => ({ id: d.id, branchId: "main", ...d.data() }) as Appointment,
  )
  GALLERY_PHOTOS = gallerySnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as GalleryPhoto,
  )
  BLOCKED_DAYS = blockedDaysSnap.docs.map((d) => {
    const data = d.data() as BlockedDay
    return { ...data, branchId: documentBranchId(d.id, data) }
  })
  BLOCKED_TIMES = blockedTimesSnap.docs.map((d) => {
    const data = d.data() as BlockedTime
    return { ...data, branchId: documentBranchId(d.id, data) }
  })
  AVAILABILITY = availabilitySnap.docs.map((d) => {
    const data = d.data() as Availability
    return { ...data, branchId: documentBranchId(d.id, data) }
  })
  BUSY_SLOTS =
    busySlotsSnap?.docs.map((d) => {
      const data = d.data() as BusySlot
      return { ...data, branchId: documentBranchId(d.id, data) }
    }) ?? []

  const settingsDoc = settingsSnap.docs.find((d) => d.id === "general")
  if (settingsDoc) {
    BUSINESS_SETTINGS = {
      ...BUSINESS_SETTINGS,
      ...settingsDoc.data() as Partial<BusinessSettings>,
    }
    SERVICE_CATEGORIES =
      BUSINESS_SETTINGS.categories && BUSINESS_SETTINGS.categories.length > 0
        ? BUSINESS_SETTINGS.categories
        : [...DEFAULT_SERVICE_CATEGORIES]
  }

  if (profile?.role === "admin") {
    try {
      await backfillBusySlots(APPOINTMENTS)
    } catch (error) {
      console.warn(
        "Publica firestore.rules para sincronizar los bloqueos existentes:",
        error,
      )
    }
  }

  dataReady = true
}

/* ============================================================
   Usuarios de demostración (el login actual es simulado, no usa
   Firebase Authentication todavía).
   ============================================================ */

export const CLIENT_USER = {
  name: "Sofía Martínez",
  email: "sofia@email.com",
  phone: "555-234-5678",
  avatar:
    "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&h=100&fit=crop&auto=format",
}

export const ADMIN_USER = {
  name: "Valeria Nail Studio",
  email: "admin@nailstudio.mx",
  phone: "555-100-2000",
  avatar:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&auto=format",
}

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]
export const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
export const WORK_HOURS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
]

function makeBusySlotId(
  date: string,
  time: string,
  branchId: BranchId = "main",
) {
  return branchDocumentId(`${date}_${time.replace(":", "")}`, branchId)
}

/* ============================================================
   Citas (appointments)
   ============================================================ */

export async function addAppointment(
  appointment: Appointment,
  branchId: BranchId = "main",
) {
  const duration = appointmentDuration(appointment)
  const appointmentRef = doc(collection(db, "appointments"))
  const id = appointmentRef.id
  const appointmentToSave = {
    ...appointment,
    duration,
    id,
    branchId,
    ...(appointment.ownerUid || !auth.currentUser?.uid
      ? {}
      : { ownerUid: auth.currentUser.uid }),
  }
  const { id: _id, ...appointmentData } = appointmentToSave
  const rest = Object.fromEntries(
    Object.entries(appointmentData).filter(([, value]) => value !== undefined),
  )
  const blocks = Math.ceil(duration / 60)
  const startMinutes = toMinutes(appointment.time)
  const slotTimes = Array.from({ length: blocks }, (_, index) =>
    toTime(startMinutes + index * 60),
  )
  const slotRefs = slotTimes.map((time) =>
    doc(db, "busySlots", makeBusySlotId(appointment.date, time, branchId)),
  )
  const blockedTimeRefs = slotTimes.map((time) =>
    doc(
      db,
      "blockedTimes",
      branchDocumentId(`${appointment.date}_${time}`, branchId),
    ),
  )
  try {
    await runTransaction(db, async (transaction) => {
      const dayBlockSnapshot = await transaction.get(
        doc(db, "blockedDays", branchDocumentId(appointment.date, branchId)),
      )
      const availabilitySnapshot = await transaction.get(
        doc(db, "availability", branchDocumentId(appointment.date, branchId)),
      )
      const slotSnapshots = await Promise.all(
        slotRefs.map((reference) => transaction.get(reference)),
      )
      const blockedTimeSnapshots = await Promise.all(
        blockedTimeRefs.map((reference) => transaction.get(reference)),
      )

      if (dayBlockSnapshot.exists())
        throw new Error("Ese día está bloqueado. Elige otra fecha.")
      if (slotSnapshots.some((snapshot) => snapshot.exists()))
        throw new Error("Ese horario acaba de ser reservado. Elige otra hora.")
      if (blockedTimeSnapshots.some((snapshot) => snapshot.exists()))
        throw new Error("Ese horario fue bloqueado. Elige otra hora.")

      const availability = availabilitySnapshot.exists()
        ? availabilitySnapshot.data() as Availability
        : getAvailability(appointment.date, branchId)
      const opening = toMinutes(availability.open)
      const closing = toMinutes(availability.close)
      if (
        !availability.enabled ||
        startMinutes < opening ||
        startMinutes + blocks * 60 > closing
      ) {
        throw new Error("Ese horario ya no está disponible. Elige otra hora.")
      }

      transaction.set(appointmentRef, rest)
      slotRefs.forEach((reference, index) =>
        transaction.set(reference, {
          date: appointment.date,
          time: slotTimes[index],
          startTime: appointment.time,
          slotIndex: index,
          duration,
          appointmentId: id,
          appointmentIds: [id],
          branchId,
        }),
      )
    })
    APPOINTMENTS.push(appointmentToSave)
    BUSY_SLOTS = [
      ...BUSY_SLOTS.filter((slot) => slot.appointmentId !== id),
      ...slotTimes.map((time) => ({
        date: appointment.date,
        time,
        duration,
        appointmentId: id,
        branchId,
      })),
    ]
  } catch (err) {
    console.error("No se pudo guardar la cita en Firestore:", err)
    throw err
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment["status"],
) {
  try {
    const appointmentRef = doc(db, "appointments", id)
    if (status === "cancelled") {
      let byArray
      let byPrimaryId
      try {
        ;[byArray, byPrimaryId] = await Promise.all([
          getDocs(
            query(
              collection(db, "busySlots"),
              where("appointmentIds", "array-contains", id),
            ),
          ),
          getDocs(
            query(
              collection(db, "busySlots"),
              where("appointmentId", "==", id),
            ),
          ),
        ])
      } catch (error) {
        if (
          !(
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "permission-denied"
          )
        )
          throw error
        await updateDoc(appointmentRef, { status })
        const appointment = APPOINTMENTS.find((item) => item.id === id)
        if (appointment) appointment.status = status
        return
      }
      const reservations = new Map(
        [...byArray.docs, ...byPrimaryId.docs].map((reservation) => [
          reservation.id,
          reservation,
        ]),
      )
      const batch = writeBatch(db)
      batch.update(appointmentRef, { status })
      reservations.forEach((reservation) => {
        const slot = reservation.data() as BusySlot
        const appointmentIds = (
          slot.appointmentIds ?? [slot.appointmentId]
        ).filter((appointmentId) => appointmentId !== id)
        if (appointmentIds.length === 0) batch.delete(reservation.ref)
        else
          batch.update(reservation.ref, {
            appointmentId: appointmentIds[0],
            appointmentIds,
          })
      })
      await batch.commit()
      BUSY_SLOTS = BUSY_SLOTS.flatMap((slot) => {
        const appointmentIds = (
          slot.appointmentIds ?? [slot.appointmentId]
        ).filter((appointmentId) => appointmentId !== id)
        return appointmentIds.length > 0
          ? [{ ...slot, appointmentId: appointmentIds[0], appointmentIds }]
          : []
      })
    } else {
      await updateDoc(appointmentRef, { status })
    }
    const appointment = APPOINTMENTS.find((item) => item.id === id)
    if (appointment) appointment.status = status
  } catch (err) {
    console.error(
      "No se pudo actualizar el estado de la cita en Firestore:",
      err,
    )
    throw err
  }
}

export async function requestAppointmentReminder(id: string) {
  try {
    await updateDoc(doc(db, "appointments", id), {
      manualReminderRequest: {
        id: doc(collection(db, "appointments")).id,
        requestedAt: serverTimestamp(),
      },
    })
  } catch (err) {
    console.error("No se pudo solicitar el recordatorio por WhatsApp:", err)
    throw err
  }
}

export async function updateAppointmentWorker(
  id: string,
  workerUid: string | null,
) {
  const appointment = APPOINTMENTS.find((item) => item.id === id)
  if (appointment) {
    if (workerUid) appointment.workerUid = workerUid
    else delete appointment.workerUid
  }
  await updateDoc(
    doc(db, "appointments", id),
    workerUid ? { workerUid } : { workerUid: null },
  )
}

export async function updateAppointmentPayment(
  id: string,
  payment: { method: Appointment["payments"][number]["method"] amount: number },
  status: Appointment["status"] = "completed",
  notes?: string,
  total?: number,
) {
  const appointment = APPOINTMENTS.find((item) => item.id === id)
  if (!appointment) return

  appointment.status = status
  appointment.payments = [payment]
  if (notes !== undefined) appointment.notes = notes
  if (total !== undefined) appointment.total = total

  try {
    await updateDoc(doc(db, "appointments", id), {
      status,
      payments: appointment.payments,
      ...(notes !== undefined ? { notes } : {}),
      ...(total !== undefined ? { total } : {}),
    })
  } catch (err) {
    console.error("No se pudo actualizar el pago en Firestore:", err)
    throw err
  }
}

export async function saveAppointmentPaymentProof(
  id: string,
  file: File,
): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Selecciona una foto en formato JPG, PNG o WEBP.")
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen debe pesar menos de 5 MB.")
  }
  if (!firebaseConfigured) {
    throw new Error("Firebase no está configurado para guardar el comprobante.")
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const proofRef = ref(
    storage,
    `paymentProofs/${id}/${Date.now()}_${safeFileName}`,
  )
  let uploaded = false
  try {
    await uploadBytes(proofRef, file, { contentType: file.type })
    uploaded = true
    const downloadUrl = await getDownloadURL(proofRef)
    await updateDoc(doc(db, "appointments", id), { paymentProof: downloadUrl })

    const appointment = APPOINTMENTS.find((item) => item.id === id)
    if (appointment) appointment.paymentProof = downloadUrl
    return downloadUrl
  } catch (error) {
    if (uploaded) {
      try {
        await deleteObject(proofRef)
      } catch (cleanupError) {
        console.error(
          "No se pudo eliminar el comprobante que no quedó vinculado:",
          cleanupError,
        )
      }
    }
    console.error("No se pudo guardar el comprobante de transferencia:", error)
    throw error
  }
}

export async function addServiceSubservice(subservice: ServiceSubservice) {
  const { id, ...data } = subservice
  try {
    await setDoc(doc(db, "serviceSubservices", id), data)
    SERVICE_SUBSERVICES = [
      ...SERVICE_SUBSERVICES.filter((item) => item.id !== id),
      subservice,
    ]
  } catch (error) {
    console.error("No se pudo crear el servicio especializado:", error)
    throw error
  }
}

export async function updateServiceSubservice(
  id: string,
  data: Partial<ServiceSubservice>,
) {
  try {
    await updateDoc(doc(db, "serviceSubservices", id), data)
    SERVICE_SUBSERVICES = SERVICE_SUBSERVICES.map((item) =>
      item.id === id ? { ...item, ...data } : item,
    )
  } catch (error) {
    console.error("No se pudo actualizar el servicio especializado:", error)
    throw error
  }
}

export async function deleteServiceSubservice(id: string) {
  try {
    await deleteDoc(doc(db, "serviceSubservices", id))
    SERVICE_SUBSERVICES = SERVICE_SUBSERVICES.filter((item) => item.id !== id)
  } catch (error) {
    console.error("No se pudo eliminar el servicio especializado:", error)
    throw error
  }
}

function parseTicketNumber(folio?: string): number {
  if (!folio) return 0
  const match = /^Loto-(\d+)$/i.exec(folio.trim())
  return match ? Number(match[1]) : 0
}

function formatTicketFolio(number: number): string {
  return `Loto-${String(number).padStart(2, "0")}`
}

export async function finalizeAppointmentPaymentWithTicketFolio(
  id: string,
  payments: Appointment["payments"],
  notes: string,
  total: number,
): Promise<string> {
  const paymentMethods = new Set(payments.map((payment) => payment.method))
  const paymentSumInCents = payments.reduce(
    (sum, payment) => sum + Math.round(payment.amount * 100),
    0,
  )
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    payments.length === 0 ||
    payments.some(
      (payment) => !Number.isFinite(payment.amount) || payment.amount <= 0,
    ) ||
    paymentMethods.size !== payments.length ||
    paymentSumInCents !== Math.round(total * 100)
  ) {
    throw new Error(
      "Las formas de pago deben ser válidas y sumar exactamente el total.",
    )
  }

  const appointmentRef = doc(db, "appointments", id)
  const sequenceRef = doc(db, "settings", "ticketSequence")
  const appointmentsSnapshot = await getDocs(collection(db, "appointments"))
  const highestExistingTicketNumber = appointmentsSnapshot.docs.reduce(
    (maxNumber, document) => {
      const appointmentData = document.data() as Partial<Appointment>
      return Math.max(maxNumber, parseTicketNumber(appointmentData.ticketFolio))
    },
    0,
  )
  let folio = ""

  await runTransaction(db, async (transaction) => {
    const [appointmentSnapshot, sequenceSnapshot] = await Promise.all([
      transaction.get(appointmentRef),
      transaction.get(sequenceRef),
    ])
    if (!appointmentSnapshot.exists())
      throw new Error("No se encontró la cita para emitir el ticket.")

    const appointmentData = appointmentSnapshot.data() as Appointment
    const lastSequenceNumber = Number(sequenceSnapshot.data()?.lastNumber ?? 0)
    const nextNumber = appointmentData.ticketFolio
      ? parseTicketNumber(appointmentData.ticketFolio)
      : Math.max(highestExistingTicketNumber, lastSequenceNumber) + 1
    folio = appointmentData.ticketFolio || formatTicketFolio(nextNumber)
    transaction.update(appointmentRef, {
      status: "completed",
      payments,
      notes,
      total,
      ticketFolio: folio,
    })

    if (!appointmentData.ticketFolio) {
      transaction.set(sequenceRef, { lastNumber: nextNumber }, { merge: true })
    }
  })

  const appointment = APPOINTMENTS.find((item) => item.id === id)
  if (appointment) {
    appointment.status = "completed"
    appointment.payments = payments
    appointment.notes = notes
    appointment.total = total
    appointment.ticketFolio = folio
  }
  return folio
}

/* ============================================================
   Disponibilidad
   ============================================================ */

export interface Availability {
  date: string
  enabled: boolean
  open: string
  close: string
  branchId?: BranchId
}

export let AVAILABILITY: Availability[] = []

export function getAvailability(
  date: string,
  branchId: BranchId = "main",
): Availability {
  const saved = AVAILABILITY.find(
    (item) => item.date === date && (item.branchId ?? "main") === branchId,
  )
  if (saved) return saved

  const day = new Date(`${date}T12:00:00`).getDay()
  const isSunday = day === 0

  return {
    date,
    enabled: !isSunday,
    open: day === 6 ? "10:00" : "09:00",
    close: day === 5 ? "19:00" : day === 6 ? "16:00" : "18:00",
    branchId,
  }
}

export async function saveAvailability(
  availability: Availability,
  branchId: BranchId = "main",
) {
  const record = { ...availability, branchId }
  const index = AVAILABILITY.findIndex(
    (item) =>
      item.date === availability.date && (item.branchId ?? "main") === branchId,
  )
  if (index === -1) AVAILABILITY.push(record)
  else AVAILABILITY[index] = record

  try {
    await setDoc(
      doc(db, "availability", branchDocumentId(availability.date, branchId)),
      record,
    )
  } catch (err) {
    console.error("No se pudo guardar la disponibilidad en Firestore:", err)
    throw err
  }
}

export async function saveBusinessSettings(settings: BusinessSettings) {
  const nextSettings: BusinessSettings = {
    ...BUSINESS_SETTINGS,
    ...settings,
    categories:
      settings.categories && settings.categories.length > 0
        ? settings.categories
        : SERVICE_CATEGORIES,
  }
  try {
    await setDoc(doc(db, "settings", "general"), nextSettings, { merge: true })
  } catch (err) {
    console.error(
      "No se pudo guardar la configuración del negocio en Firestore:",
      err,
    )
    throw err
  }
  BUSINESS_SETTINGS = nextSettings
  SERVICE_CATEGORIES = nextSettings.categories ?? [
    ...DEFAULT_SERVICE_CATEGORIES,
  ]
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

export function getBookedTimes(date: string, branchId: BranchId = "main") {
  const booked = new Set(
    BLOCKED_TIMES.filter(
      (item) => item.date === date && (item.branchId ?? "main") === branchId,
    ).map((item) => item.time),
  )
  BUSY_SLOTS.filter(
    (item) => item.date === date && (item.branchId ?? "main") === branchId,
  ).forEach((item) => booked.add(item.time))
  APPOINTMENTS.filter(
    (item) =>
      item.date === date &&
      (item.branchId ?? "main") === branchId &&
      item.status !== "cancelled",
  ).forEach((item) => {
    const start = toMinutes(item.time)
    const blocks = Math.ceil(appointmentDuration(item) / 60)
    for (let block = 0; block < blocks; block += 1)
      booked.add(toTime(start + block * 60))
  })
  return booked
}

export async function refreshBusySlots(date: string) {
  const snapshot = await getDocs(
    query(collection(db, "busySlots"), where("date", "==", date)),
  )
  const refreshedSlots = snapshot.docs.map((item) => {
    const data = item.data() as BusySlot
    return { ...data, branchId: documentBranchId(item.id, data) }
  })
  BUSY_SLOTS = [
    ...BUSY_SLOTS.filter((slot) => slot.date !== date),
    ...refreshedSlots,
  ]
}

export function getAvailableTimes(
  date: string,
  duration: number,
  branchId: BranchId = "main",
) {
  const availability = getAvailability(date, branchId)
  if (!availability.enabled) return []

  const open = toMinutes(availability.open)
  const close = toMinutes(availability.close)
  const blocks = Math.ceil(duration / 60)
  const booked = getBookedTimes(date, branchId)
  const times: string[] = []
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const isToday = date === today

  // Cuando ya llego la hora de cierre, el dia no puede ofrecer ningun horario.
  if (isToday && currentMinutes >= close) return []

  for (let start = open; start + blocks * 60 <= close; start += 60) {
    const slots = Array.from({ length: blocks }, (_, index) =>
      toTime(start + index * 60),
    )
    if (
      (!isToday || start > currentMinutes) &&
      slots.every((slot) => !booked.has(slot))
    ) {
      times.push(toTime(start))
    }
  }
  return times
}

export function getNextAvailableDays(
  duration = 60,
  count = 3,
  branchId: BranchId = "main",
) {
  const days: { date: string label: string day: string times: string[] }[] = []
  const start = new Date()

  for (let offset = 0; offset < 21 && days.length < count; offset += 1) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset,
    )
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const times = getAvailableTimes(dateKey, duration, branchId).slice(0, 4)
    if (times.length === 0) continue

    days.push({
      date: dateKey,
      label: offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : "",
      day: date.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      times,
    })
  }

  return days
}

/* ============================================================
   Servicios (catálogo) — usadas por AdminCatalogPage.tsx
   ============================================================ */

export async function addServiceFS(service: Service) {
  const { id, ...rest } = service
  try {
    await setDoc(doc(db, "services", id), rest)
  } catch (err) {
    console.error("No se pudo crear el servicio en Firestore:", err)
    throw err
  }
}

export async function updateServiceFS(id: string, data: Partial<Service>) {
  try {
    await updateDoc(doc(db, "services", id), data)
  } catch (err) {
    console.error("No se pudo actualizar el servicio en Firestore:", err)
    throw err
  }
}

export async function deleteServiceFS(id: string) {
  try {
    await deleteDoc(doc(db, "services", id))
  } catch (err) {
    console.error("No se pudo eliminar el servicio en Firestore:", err)
  }
}

/* ============================================================
   Galería — usadas por admin/GalleryPage.tsx
   ============================================================ */

export async function addGalleryPhotoFS(photo: GalleryPhoto) {
  const { id, ...rest } = photo
  try {
    await setDoc(doc(db, "galleryPhotos", id), rest)
  } catch (err) {
    console.error("No se pudo agregar la fotografía en Firestore:", err)
  }
}

export async function deleteGalleryPhotoFS(id: string) {
  try {
    await deleteDoc(doc(db, "galleryPhotos", id))
  } catch (err) {
    console.error("No se pudo eliminar la fotografía en Firestore:", err)
  }
}

export async function updateGalleryPhotoFS(
  id: string,
  data: Partial<Omit<GalleryPhoto, "id">>,
) {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )
  await updateDoc(doc(db, "galleryPhotos", id), cleanData)
}

export async function updateGalleryPhotoOrderFS(photos: GalleryPhoto[]) {
  try {
    await Promise.all(
      photos.map((p) =>
        updateDoc(doc(db, "galleryPhotos", p.id), { order: p.order }),
      ),
    )
  } catch (err) {
    console.error(
      "No se pudo actualizar el orden de la galería en Firestore:",
      err,
    )
  }
}
