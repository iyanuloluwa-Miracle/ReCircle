import { createError, defineEventHandler, setResponseStatus } from 'h3'
import type { AuthResponse } from '../../../types'
import { User } from '../../models/User'
import { hashPassword } from '../../services/password'
import { registerSchema, toAuthUser } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { getAuthSession } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const { name, email, password } = await readValidatedJson(event, registerSchema)
  await connectDatabase()
  // Roles are never accepted from public registration.
  try {
    const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: 'user', isDemo: false })
    const session = await getAuthSession(event)
    await session.update({ userId: user.id })
    setResponseStatus(event, 201)
    return { user: toAuthUser(user) }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
    }
    throw error
  }
})
