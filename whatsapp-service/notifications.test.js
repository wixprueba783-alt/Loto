import assert from "node:assert/strict"

import test from "node:test"

import {
  appointmentConfirmedMessage,
  appointmentReceivedMessage,
  appointmentReminderMessage,
  appointmentTimestamp,
  isAppointmentReminderDue,
  normalizePhone,
} from "./notifications.js"

test("normalizes Mexican ten-digit and legacy mobile numbers", () => {
  assert.equal(normalizePhone("(81) 1234-5678"), "528112345678@c.us")

  assert.equal(normalizePhone("+52 1 81 1234 5678"), "528112345678@c.us")
})

test("preserves a valid international phone number and rejects invalid lengths", () => {
  assert.equal(normalizePhone("+1 (415) 555-2671"), "14155552671@c.us")

  assert.equal(normalizePhone("12345"), null)
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

  assert.match(confirmation, /Hola Ana!/)

  assert.match(confirmation, /17\/10\/2026/)

  assert.match(confirmation, /12:00/)

  assert.match(confirmation, /confirmada/)

  const reminder = appointmentReminderMessage(appointment)

  assert.match(reminder, /Hola Ana!/)

  assert.match(reminder, /17\/10\/2026/)

  assert.match(reminder, /12:00/)

  assert.match(reminder, /Sí, asistiré/)
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
