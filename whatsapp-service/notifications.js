export function normalizePhone(phone) {
  let digits = String(phone ?? "").replace(/\D/g, "")

  if (digits.length === 10) digits = `52${digits}`

  if (digits.startsWith("521") && digits.length === 13)
    digits = `52${digits.slice(3)}`

  if (digits.length < 11 || digits.length > 15) return null

  return `${digits}@c.us`
}

function getFirstName(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)[0] || "cliente"
  )
}

function formatDate(date) {
  const [year, month, day] = String(date ?? "").split("-")

  if (!year || !month || !day) return String(date ?? "fecha pendiente")

  return `${day}/${month}/${year}`
}

export function appointmentReceivedMessage(appointment) {
  return `💅✨ ¡Hola ${getFirstName(appointment.clientName)}! Recibimos tu solicitud de cita. 💗\n\nTe esperamos en la fecha y hora seleccionadas. Agradecemos mucho tu preferencia y confianza. Te avisaremos cuando quede confirmada. ✨`
}

export function appointmentConfirmedMessage(appointment) {
  return `💅✨ ¡Hola ${getFirstName(appointment.clientName)}! Tu cita ha sido *confirmada*. 🩷\n\nTe esperamos en la fecha y hora seleccionadas:\n📅 Fecha: ${formatDate(appointment.date)}\n🕐 Hora: ${appointment.time ?? "hora pendiente"}\n\nAgradecemos mucho tu preferencia y confianza. ¡Nos vemos pronto! ✨`
}

export function appointmentReminderMessage(appointment) {
  return `💅✨ ¡Hola ${getFirstName(appointment.clientName)}! Te recordamos que tienes una cita próximamente.\n\n📅 Fecha: ${formatDate(appointment.date)}\n🕐 Hora: ${appointment.time ?? "hora pendiente"}\n\nPor favor, *confírmanos tu asistencia* respondiendo a este mensaje con un *“Sí, asistiré”*. 💖\n\n¡Te esperamos! Gracias por tu preferencia. ✨`
}

export function appointmentTimestamp(
  appointment,
  timeZone = "America/Mexico_City",
) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(appointment.date ?? ""),
  )

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(appointment.time ?? ""))

  if (!dateMatch || !timeMatch) return null

  const [, year, month, day] = dateMatch.map(Number)

  const [, hour, minute] = timeMatch.map(Number)

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute)

  const requestedDate = new Date(localAsUtc)

  if (
    requestedDate.getUTCFullYear() !== year ||
    requestedDate.getUTCMonth() !== month - 1 ||
    requestedDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  )
    return null

  const getOffset = (instant) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,

      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit",

      hourCycle: "h23",
    }).formatToParts(new Date(instant))

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )

    return (
      Date.UTC(
        Number(values.year),

        Number(values.month) - 1,

        Number(values.day),

        Number(values.hour),

        Number(values.minute),

        Number(values.second),
      ) - instant
    )
  }

  let timestamp = localAsUtc - getOffset(localAsUtc)

  timestamp = localAsUtc - getOffset(timestamp)

  return new Date(timestamp)
}

export function isAppointmentReminderDue(
  appointment,
  now = Date.now(),
  timeZone = "America/Mexico_City",
  reminderHours = 24,
) {
  const appointmentAt = appointmentTimestamp(appointment, timeZone)

  if (
    !appointmentAt ||
    !Number.isFinite(Number(reminderHours)) ||
    Number(reminderHours) <= 0
  )
    return false

  const appointmentTime = appointmentAt.getTime()

  return (
    now >= appointmentTime - Number(reminderHours) * 60 * 60 * 1000 &&
    now < appointmentTime
  )
}
