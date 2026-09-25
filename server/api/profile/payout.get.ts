import { createError, defineEventHandler } from 'h3'
import { User } from '../../models/User'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const sessionUser = await requireSessionUser(event, ['user'])
  await connectDatabase()
  const user = await User.findById(sessionUser.id)
    .select('bankCode accountNumber accountName paystackRecipientCode')
    .lean()
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  return {
    payout: {
      bankCode: user.bankCode ?? null,
      accountNumber: user.accountNumber ?? null,
      accountName: user.accountName ?? null,
      hasRecipient: Boolean(user.paystackRecipientCode)
    }
  }
})
