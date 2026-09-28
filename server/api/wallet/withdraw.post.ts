import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { startConsumerWithdraw } from '../../services/wallet'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const bodySchema = z.strictObject({
  amount: z.number().finite().positive().max(5_000_000)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const body = await readValidatedJson(event, bodySchema)
  return startConsumerWithdraw({
    userId: user.id,
    amountNaira: body.amount
  })
})
