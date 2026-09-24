import { createError, defineEventHandler } from 'h3'
import type { AuthResponse } from '../../../types'
import { User } from '../../models/User'
import { demoEmailByRole, demoSchema, toAuthUser } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { getAuthSession } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const { role } = await readValidatedJson(event, demoSchema)
  await connectDatabase()
  const email = demoEmailByRole[role]
  const user = email ? await User.findOne({ email, role, isDemo: true }) : null
  if (!user) throw createError({ statusCode: 503, statusMessage: 'Demo account is unavailable' })
  const session = await getAuthSession(event)
  await session.update({ userId: user.id })
  return { user: toAuthUser(user) }
})
