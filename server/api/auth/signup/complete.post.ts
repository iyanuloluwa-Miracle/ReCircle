import { defineEventHandler, setResponseStatus } from 'h3'
import type { AuthResponse } from '../../../../types'
import { completeSignup, signupCompleteSchema, toAuthUser } from '../../../services/auth'
import { connectDatabase } from '../../../utils/db'
import { assertSameOrigin } from '../../../utils/origin'
import { getAuthSession } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const { email, password, signupToken } = await readValidatedJson(event, signupCompleteSchema)
  await connectDatabase()
  const user = await completeSignup(email, password, signupToken)
  const session = await getAuthSession(event)
  await session.update({ userId: user.id })
  setResponseStatus(event, 201)
  return { user: toAuthUser(user) }
})
