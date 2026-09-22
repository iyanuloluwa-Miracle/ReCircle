/** Consecutive UTC days ending today (or yesterday) with at least one completed pickup. */
export function computeRecyclingStreak(completedDates: Date[], now = new Date()) {
  if (completedDates.length === 0) return 0
  const dayKey = (date: Date) => date.toISOString().slice(0, 10)
  const startOfUtcDay = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const days = new Set(completedDates.map(dayKey))
  let cursor = startOfUtcDay(now)
  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - 86_400_000)
    if (!days.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor = new Date(cursor.getTime() - 86_400_000)
  }
  return streak
}

export function formatPickupArea(location: { coordinates: [number, number] } | null | undefined) {
  if (!location?.coordinates || location.coordinates.length < 2) return 'Pickup area unavailable'
  const [lng, lat] = location.coordinates
  return `${lat.toFixed(3)}°N, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
}
