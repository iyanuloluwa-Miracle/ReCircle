import { defineEventHandler, setResponseStatus } from 'h3'
import type { AuthResponse } from '../../../types'
import { googleAuthSchema, signInWithGoogle, toAuthUser } from '../../services/auth'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { getAuthSession } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const { idToken, role } = await readValidatedJson(event, googleAuthSchema)
  await connectDatabase()
  const user = await signInWithGoogle(idToken, role)
  const session = await getAuthSession(event)
  await session.update({ userId: user.id })
  setResponseStatus(event, 200)
  return { user: toAuthUser(user) }
})
