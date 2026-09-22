import { createError, defineEventHandler, setResponseStatus } from 'h3'
import type { AuthResponse } from '../../../types'
import { Recycler } from '../../models/Recycler'
import { User } from '../../models/User'
import { toAuthUser } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const sessionUser = await requireSessionUser(event)
  await connectDatabase()
  const user = await User.findById(sessionUser.id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (!user.avatarUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Choose an avatar before finishing onboarding' })
  }
  if (user.role === 'user' && !user.location) {
    throw createError({ statusCode: 400, statusMessage: 'Set a pickup location before finishing onboarding' })
  }
  if (user.role === 'recycler') {
    const profile = await Recycler.findOne({ userId: user._id }).select('_id').lean()
    if (!profile) {
      throw createError({ statusCode: 400, statusMessage: 'Complete your recycler profile before finishing onboarding' })
    }
  }
  user.onboardingCompletedAt = new Date()
  await user.save()
  setResponseStatus(event, 200)
  return { user: toAuthUser(user) }
})
