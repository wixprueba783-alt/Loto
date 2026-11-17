export function getAppointmentTimeSlots(startTime: string, duration: number) {
  const [hours, minutes] = startTime.split(":").map(Number)
  const startMinutes = hours * 60 + minutes
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 1
  const blocks = Math.ceil(safeDuration / 60)

  return Array.from({ length: blocks }, (_, index) => {
    const slotMinutes = startMinutes + index * 60
    const slotHours = Math.floor(slotMinutes / 60)
    const slotRemainder = slotMinutes % 60
    return `${String(slotHours).padStart(2, "0")}:${String(slotRemainder).padStart(2, "0")}`
  })
}
