import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { sendRequestMessage } from '../../../../services/chat'
import { assertSameOrigin } from '../../../../utils/origin'
import { requireSessionUser } from '../../../../utils/session'
import { readValidatedJson } from '../../../../utils/validation'

const bodySchema = z.strictObject({
  body: z.string().trim().min(1).max(1000)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'recycler'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Pickup request not found' })
  }

  const { body } = await readValidatedJson(event, bodySchema)
  return sendRequestMessage({
    requestId: id,
    actorUserId: user.id,
    actorRole: user.role,
    body
  })
})
