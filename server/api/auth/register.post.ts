import { createError, defineEventHandler } from 'h3'
import type { AuthResponse } from '../../../types'
import { startSignup, signupStartSchema } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { readValidatedJson } from '../../utils/validation'

/** Legacy path: starts email-first signup (role + name + email). Prefer /api/auth/signup/start. */
export default defineEventHandler(async (event): Promise<{ email: string }> => {
  assertSameOrigin(event)
  const body = await readValidatedJson(event, signupStartSchema)
  await connectDatabase()
  try {
    return await startSignup(body)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 500, statusMessage: 'Could not start registration' })
  }
})
