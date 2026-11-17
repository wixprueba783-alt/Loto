import assert from "node:assert/strict"
import test from "node:test"

import { getAppointmentTimeSlots } from "./appointment-slots.ts"

test("reserves each hour covered by a service duration", () => {
  assert.deepEqual(getAppointmentTimeSlots("09:00", 60), ["09:00"])
  assert.deepEqual(getAppointmentTimeSlots("09:00", 120), ["09:00", "10:00"])
  assert.deepEqual(getAppointmentTimeSlots("09:00", 180), [
    "09:00",
    "10:00",
    "11:00",
  ])
})

test("rounds partial hours up and preserves the appointment start minute", () => {
  assert.deepEqual(getAppointmentTimeSlots("09:30", 90), ["09:30", "10:30"])
})

test("uses a single occupied slot for invalid or non-positive durations", () => {
  assert.deepEqual(getAppointmentTimeSlots("09:00", 0), ["09:00"])
  assert.deepEqual(getAppointmentTimeSlots("09:00", Number.NaN), ["09:00"])
})
