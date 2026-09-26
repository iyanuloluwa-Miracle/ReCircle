import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { listRequestMessages } from '../../../../services/chat'
import { requireSessionUser } from '../../../../utils/session'

const querySchema = z.object({
  after: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user', 'recycler'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Pickup request not found' })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  const after = parsed.success ? parsed.data.after : undefined

  return listRequestMessages({
    requestId: id,
    actorUserId: user.id,
    actorRole: user.role,
    after: after ?? null
  })
})
