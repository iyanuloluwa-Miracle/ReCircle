import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import type { AuthResponse } from '../../../types'
import { User } from '../../models/User'
import { toAuthUser } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const longitude = z.number().finite().min(-180).max(180)
const latitude = z.number().finite().min(-90).max(90)

const locationBodySchema = z.strictObject({
  location: z.strictObject({
    type: z.literal('Point'),
    coordinates: z.tuple([longitude, latitude])
  })
})

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const sessionUser = await requireSessionUser(event)
  const { location } = await readValidatedJson(event, locationBodySchema)
  await connectDatabase()
  const user = await User.findByIdAndUpdate(
    sessionUser.id,
    { $set: { location } },
    { new: true }
  )
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  return { user: toAuthUser(user) }
})
