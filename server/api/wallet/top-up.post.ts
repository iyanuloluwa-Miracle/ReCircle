import { defineEventHandler, getRequestURL } from 'h3'
import { z } from 'zod'
import { startRecyclerTopUp } from '../../services/wallet'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const bodySchema = z.strictObject({
  amount: z.number().finite().positive().max(5_000_000)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['recycler'])
  const body = await readValidatedJson(event, bodySchema)
  const origin = getRequestURL(event).origin
  return startRecyclerTopUp({
    userId: user.id,
    email: user.email,
    amountNaira: body.amount,
    callbackUrl: `${origin}/dashboard/recycler`
  })
})
