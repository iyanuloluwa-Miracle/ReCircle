export interface OperatingHoursDay {
  day: number
  open: string
  close: string
  enabled: boolean
}

export const defaultOperatingHours: OperatingHoursDay[] = [
  { day: 0, open: '09:00', close: '17:00', enabled: false },
  { day: 1, open: '09:00', close: '17:00', enabled: true },
  { day: 2, open: '09:00', close: '17:00', enabled: true },
  { day: 3, open: '09:00', close: '17:00', enabled: true },
  { day: 4, open: '09:00', close: '17:00', enabled: true },
  { day: 5, open: '09:00', close: '17:00', enabled: true },
  { day: 6, open: '09:00', close: '17:00', enabled: true }
]

export function normalizeOperatingHours(value?: OperatingHoursDay[] | null) {
  if (!value?.length) return defaultOperatingHours.map(day => ({ ...day }))
  return defaultOperatingHours.map((fallback) => {
    const current = value.find(day => day.day === fallback.day)
    return current ? { ...current } : { ...fallback }
  })
}

function minutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return -1
  const hour = Number(match[1]); const minute = Number(match[2])
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : -1
}

/** Nigeria is currently the supported collection market, so matching is evaluated in WAT. */
export function isOpenForMatching(hours?: OperatingHoursDay[] | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'))
  const current = Number(part('hour')) * 60 + Number(part('minute'))
  const today = normalizeOperatingHours(hours).find(entry => entry.day === day)
  if (!today?.enabled) return false
  const opens = minutes(today.open); const closes = minutes(today.close)
  return opens >= 0 && closes > opens && current >= opens && current < closes
}
