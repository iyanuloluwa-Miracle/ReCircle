import { defineEventHandler } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { createPickupRequest } from '../services/pickup-requests'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const bodySchema = z.strictObject({
  wasteItemId: z.string().refine(value => Types.ObjectId.isValid(value)),
  recyclerId: z.string().refine(value => Types.ObjectId.isValid(value))
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const body = await readValidatedJson(event, bodySchema)
  return createPickupRequest({
    userId: user.id,
    wasteItemId: body.wasteItemId,
    recyclerId: body.recyclerId,
    isDemo: user.isDemo
  })
})
