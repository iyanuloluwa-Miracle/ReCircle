/**
 * Structured payout / Paystack debug logger.
 * Enable with PAYOUT_DEBUG=1 in .env, then copy lines tagged [recircle:payout]
 * from the terminal, or GET /api/debug/payout-log, or the payoutDebug field
 * on the PATCH /api/requests/:id/status response when status=completed.
 */

export type PayoutLogLevel = 'info' | 'warn' | 'error'

export interface PayoutLogEntry {
  at: string
  level: PayoutLogLevel
  event: string
  requestId?: string
  message: string
  data?: Record<string, unknown>
}

const MAX_ENTRIES = 100
const entries: PayoutLogEntry[] = []

function redactRecipient(code: string | null | undefined) {
  if (!code) return null
  if (code.length <= 6) return '***'
  return `${code.slice(0, 4)}…${code.slice(-4)}`
}

function sanitize(data?: Record<string, unknown>) {
  if (!data) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase()
    if (lower.includes('secret') || lower.includes('password') || lower === 'authorization') {
      out[key] = '[redacted]'
      continue
    }
    if (lower.includes('recipient')) {
      out[key] = typeof value === 'string' ? redactRecipient(value) : value
      continue
    }
    out[key] = value
  }
  return out
}

export function isPayoutDebugEnabled() {
  const raw = String(process.env.PAYOUT_DEBUG || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function logPayout(
  event: string,
  message: string,
  data?: Record<string, unknown>,
  level: PayoutLogLevel = 'info'
) {
  const entry: PayoutLogEntry = {
    at: new Date().toISOString(),
    level,
    event,
    requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
    message,
    data: sanitize(data)
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)

  const payload = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
  const line = `[recircle:payout] ${entry.at} ${level.toUpperCase()} ${event} — ${message}${payload}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)

  return entry
}

export function getPayoutLogs(options?: { requestId?: string; limit?: number }) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), MAX_ENTRIES)
  let list = entries
  if (options?.requestId) {
    list = entries.filter(entry => entry.requestId === options.requestId)
  }
  return list.slice(-limit)
}

export function formatPayoutLogsForCopy(options?: { requestId?: string; limit?: number }) {
  return getPayoutLogs(options)
    .map((entry) => {
      const payload = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
      return `[recircle:payout] ${entry.at} ${entry.level.toUpperCase()} ${entry.event} — ${entry.message}${payload}`
    })
    .join('\n')
}
