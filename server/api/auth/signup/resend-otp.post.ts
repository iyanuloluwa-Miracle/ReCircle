import { defineEventHandler } from 'h3'
import { resendSignupOtp, signupResendSchema } from '../../../services/auth'
import { connectDatabase } from '../../../utils/db'
import { assertSameOrigin } from '../../../utils/origin'
import { readValidatedJson } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { email } = await readValidatedJson(event, signupResendSchema)
  await connectDatabase()
  return resendSignupOtp(email)
})
