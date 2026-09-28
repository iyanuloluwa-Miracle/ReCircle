import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { verifyAndApplyRecyclerTopUp } from '../../../services/wallet'
import { assertSameOrigin } from '../../../utils/origin'
import { requireSessionUser } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'

const bodySchema = z.strictObject({
  reference: z.string().trim().min(1).max(120)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['recycler'])
  const body = await readValidatedJson(event, bodySchema)
  return verifyAndApplyRecyclerTopUp({
    userId: user.id,
    reference: body.reference
  })
})
