import { createError, defineEventHandler, getQuery } from 'h3'
import {
  formatPayoutLogsForCopy,
  getPayoutLogs,
  isPayoutDebugEnabled
} from '../../utils/payout-logger'
import { requireSessionUser } from '../../utils/session'

/**
 * Copy-paste payout debug dump for local investigation.
 * Requires PAYOUT_DEBUG=1 in .env.
 */
export default defineEventHandler(async (event) => {
  if (!isPayoutDebugEnabled()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Payout debug is off. Set PAYOUT_DEBUG=1 in .env and restart the server.'
    })
  }
  await requireSessionUser(event, ['user', 'recycler', 'admin'])
  const query = getQuery(event)
  const requestId = typeof query.requestId === 'string' ? query.requestId : undefined
  const limit = typeof query.limit === 'string' ? Number(query.limit) : 50
  const logs = getPayoutLogs({ requestId, limit: Number.isFinite(limit) ? limit : 50 })
  return {
    enabled: true,
    requestId: requestId ?? null,
    count: logs.length,
    /** Paste this string into chat when asking for help. */
    copyPaste: formatPayoutLogsForCopy({ requestId, limit: Number.isFinite(limit) ? limit : 50 }),
    logs
  }
})
