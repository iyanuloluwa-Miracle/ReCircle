import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { reschedulePickupRequest } from '../../../services/pickup-requests'
import { assertSameOrigin } from '../../../utils/origin'
import { requireSessionUser } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'

const bodySchema = z.strictObject({ requestedPickupTime: z.string().datetime({ offset: true }) })
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Pickup request not found' })
  const { requestedPickupTime } = await readValidatedJson(event, bodySchema)
  const time = new Date(requestedPickupTime)
  if (time.getTime() < Date.now() + 30 * 60 * 1000) throw createError({ statusCode: 400, statusMessage: 'Choose a pickup time at least 30 minutes from now' })
  return reschedulePickupRequest({ requestId: id, userId: user.id, requestedPickupTime: time })
})
