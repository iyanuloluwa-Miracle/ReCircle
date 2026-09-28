import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { getWalletLedger } from '../../services/wallet'
import { requireSessionUser } from '../../utils/session'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user', 'recycler'])
  const query = querySchema.parse(getQuery(event))
  return getWalletLedger(user, { limit: query.limit, offset: query.offset })
})
