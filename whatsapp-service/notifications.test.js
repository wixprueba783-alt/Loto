import assert from "node:assert/strict"

import test from "node:test"

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

test("normalizes Mexican ten-digit and legacy mobile numbers", () => {
  assert.equal(normalizePhone("(81) 1234-5678"), "528112345678@c.us")

  assert.equal(normalizePhone("+52 1 81 1234 5678"), "528112345678@c.us")
})

test("preserves a valid international phone number and rejects invalid lengths", () => {
  assert.equal(normalizePhone("+1 (415) 555-2671"), "14155552671@c.us")

  assert.equal(normalizePhone("12345"), null)
})

test("serializes WhatsApp contact IDs returned by getNumberId", () => {
  assert.equal(serializeWhatsAppId("123@lid"), "123@lid")
  assert.equal(serializeWhatsAppId({ _serialized: "123@c.us" }), "123@c.us")
  assert.equal(serializeWhatsAppId({ user: "123", server: "lid" }), "123@lid")
  assert.equal(serializeWhatsAppId(null), null)
})

test("builds all three appointment messages using the client first name", () => {
  const appointment = {
    clientName: "Ana López",

    date: "2026-10-17",

    time: "12:00",
  }

  assert.equal(
    appointmentReceivedMessage(appointment),

    "💅✨ ¡Hola Ana! Recibimos tu solicitud de cita. 💗\n\nTe esperamos en la fecha y hora seleccionadas. Agradecemos mucho tu preferencia y confianza. Te avisaremos cuando quede confirmada. ✨",
  )

  const confirmation = appointmentConfirmedMessage(appointment)

  assert.equal(
    confirmation,
    "💅✨ ¡Hola Ana! Tu cita ha sido *confirmada*. 🩷\n\nTe esperamos en la fecha y hora seleccionadas:\n📅 Fecha: 17/10/2026\n🕐 Hora: 12:00\n\nAgradecemos mucho tu preferencia y confianza. ¡Nos vemos pronto! ✨",
  )
  assert.match(confirmation, /Hola Ana!/)

  assert.match(confirmation, /17\/10\/2026/)

  assert.match(confirmation, /12:00/)

  assert.match(confirmation, /confirmada/)

  const reminder = appointmentReminderMessage(appointment)

  assert.equal(
    reminder,
    "💅✨ ¡Hola Ana! Te recordamos que tienes una cita próximamente.\n\n📅 Fecha: 17/10/2026\n🕐 Hora: 12:00\n\nPor favor, confírmanos tu asistencia respondiendo a este mensaje con un “Sí, asistiré”. 💖\n\n¡Te esperamos! Gracias por tu preferencia. ✨",
  )
  assert.match(reminder, /Hola Ana!/)

  assert.match(reminder, /17\/10\/2026/)

  assert.match(reminder, /12:00/)

  assert.match(reminder, /Sí, asistiré/)
})

test("capitalizes the first name in appointment messages", () => {
  assert.match(appointmentReceivedMessage({ clientName: "dwad lopez" }), /¡Hola Dwad!/)
})

test("renders only the supported appointment template placeholders", () => {
  const message = formatAppointmentTemplate(
    "Hola {firstName}, tu {service} es el {date} a las {time}.",
    {
      clientName: "Ana López",
      date: "2026-10-17",
      time: "12:00",
      services: [{ name: "Gel" }, { name: "Diseño" }],
    },
  )

  assert.equal(message, "Hola Ana, tu Gel, Diseño es el 17/10/2026 a las 12:00.")
  assert.equal(formatAppointmentTemplate("{unsupported}", {}), "{unsupported}")
})

test("converts appointment local time to the configured Mexico City timezone", () => {
  const appointment = { date: "2026-10-17", time: "12:00" }

  const instant = appointmentTimestamp(appointment)

  assert.equal(instant.toISOString(), "2026-10-17T18:00:00.000Z")

  assert.equal(appointmentTimestamp({ date: "invalid", time: "12:00" }), null)

  assert.equal(
    isAppointmentReminderDue(appointment, Date.parse("2026-10-16T17:59:59Z")),
    false,
  )

  assert.equal(
    isAppointmentReminderDue(appointment, Date.parse("2026-10-16T18:00:00Z")),
    true,
  )

  assert.equal(
    isAppointmentReminderDue(
      appointment,
      Date.parse("2026-10-16T06:00:00Z"),
      "America/Mexico_City",
      36,
    ),
    true,
  )

  assert.equal(
    isAppointmentReminderDue(
      appointment,
      Date.parse("2026-10-16T06:00:00Z"),
      "America/Mexico_City",
      12,
    ),
    false,
  )

  assert.equal(
    isAppointmentReminderDue(appointment, Date.parse("2026-10-17T18:00:00Z")),
    false,
  )
})
