import { defineEventHandler } from 'h3'
import { signupOtpSchema, verifySignupOtp } from '../../../services/auth'
import { connectDatabase } from '../../../utils/db'
import { assertSameOrigin } from '../../../utils/origin'
import { readValidatedJson } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { email, code } = await readValidatedJson(event, signupOtpSchema)
  await connectDatabase()
  return verifySignupOtp(email, code)
})
