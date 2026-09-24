import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { updateRequestStatus } from '../../../services/pickup-requests'
import { assertSameOrigin } from '../../../utils/origin'
import { requireSessionUser } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'
import { requestStatuses } from '../../../../utils/request-lifecycle'

const bodySchema = z.strictObject({
  status: z.enum(requestStatuses),
  confirmedPickupTime: z.string().datetime({ offset: true }).nullable().optional()
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'recycler'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Pickup request not found' })
  const { status, confirmedPickupTime } = await readValidatedJson(event, bodySchema)
  if (confirmedPickupTime && new Date(confirmedPickupTime).getTime() < Date.now() + 30 * 60 * 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a pickup time at least 30 minutes from now' })
  }
  return updateRequestStatus({
    requestId: id,
    nextStatus: status,
    confirmedPickupTime: confirmedPickupTime ? new Date(confirmedPickupTime) : null,
    actorUserId: user.id,
    actorRole: user.role
  })
})
