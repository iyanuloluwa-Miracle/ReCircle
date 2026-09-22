import { createError, defineEventHandler } from 'h3'
import type { AuthResponse } from '../../../types'
import { User } from '../../models/User'
import { loginSchema, toAuthUser } from '../../services/auth'
import { verifyPassword } from '../../services/password'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { getAuthSession } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const { email, password } = await readValidatedJson(event, loginSchema)
  await connectDatabase()
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }
  if (!user.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'This account uses Google sign-in. Continue with Google instead.'
    })
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }
  const session = await getAuthSession(event)
  await session.update({ userId: user.id })
  return { user: toAuthUser(user) }
})
