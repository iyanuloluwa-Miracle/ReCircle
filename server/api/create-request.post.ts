import { createError, defineEventHandler } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { createPickupRequest } from '../services/pickup-requests'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const bodySchema = z.strictObject({
  wasteItemId: z.string().refine(value => Types.ObjectId.isValid(value)),
  recyclerId: z.string().refine(value => Types.ObjectId.isValid(value)),
  requestedPickupTime: z.string().datetime({ offset: true }).optional().nullable()
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const body = await readValidatedJson(event, bodySchema)
  const requestedPickupTime = body.requestedPickupTime ? new Date(body.requestedPickupTime) : null
  if (requestedPickupTime && requestedPickupTime.getTime() < Date.now() + 30 * 60 * 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a pickup time at least 30 minutes from now' })
  }
  return createPickupRequest({
    userId: user.id,
    wasteItemId: body.wasteItemId,
    recyclerId: body.recyclerId,
    requestedPickupTime,
    isDemo: user.isDemo
  })
})
