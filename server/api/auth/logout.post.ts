import { defineEventHandler } from 'h3'
import { assertSameOrigin } from '../../utils/origin'
import { getAuthSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const session = await getAuthSession(event)
  await session.clear()
  return { ok: true }
})
