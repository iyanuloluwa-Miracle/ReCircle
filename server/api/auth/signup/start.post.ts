import { defineEventHandler, setResponseStatus } from 'h3'
import { startSignup, signupStartSchema } from '../../../services/auth'
import { connectDatabase } from '../../../utils/db'
import { assertSameOrigin } from '../../../utils/origin'
import { readValidatedJson } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readValidatedJson(event, signupStartSchema)
  await connectDatabase()
  const result = await startSignup(body)
  setResponseStatus(event, 200)
  return result
})
