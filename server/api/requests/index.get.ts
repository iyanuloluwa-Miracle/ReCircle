import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { listRequestsForActor } from '../../services/pickup-requests'
import { requireSessionUser } from '../../utils/session'
import { requestStatuses } from '../../../utils/request-lifecycle'

const querySchema = z.object({
  status: z.enum(requestStatuses).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user', 'recycler', 'admin'])
  const parsed = querySchema.safeParse(getQuery(event))
  const status = parsed.success ? parsed.data.status : undefined
  const requests = await listRequestsForActor({
    userId: user.id,
    role: user.role,
    status
  })
  return { requests }
})
