import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { updateRequestStatus } from '../../../services/pickup-requests'
import { assertSameOrigin } from '../../../utils/origin'
import { requireSessionUser } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'
import { requestStatuses } from '../../../../utils/request-lifecycle'

const bodySchema = z.strictObject({
  status: z.enum(requestStatuses)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'recycler'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Pickup request not found' })
  const { status } = await readValidatedJson(event, bodySchema)
  return updateRequestStatus({
    requestId: id,
    nextStatus: status,
    actorUserId: user.id,
    actorRole: user.role
  })
})
