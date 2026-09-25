import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { User } from '../../models/User'
import { createTransferRecipient, resolveBankAccount } from '../../services/paystack'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const bodySchema = z.strictObject({
  bankCode: z.string().trim().min(2).max(10),
  accountNumber: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit NUBAN account number')
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const sessionUser = await requireSessionUser(event, ['user'])
  const body = await readValidatedJson(event, bodySchema)
  await connectDatabase()

  const resolved = await resolveBankAccount(body.accountNumber, body.bankCode)
  const recipient = await createTransferRecipient({
    name: resolved.accountName || sessionUser.name,
    accountNumber: resolved.accountNumber || body.accountNumber,
    bankCode: body.bankCode
  })

  const user = await User.findByIdAndUpdate(
    sessionUser.id,
    {
      $set: {
        bankCode: body.bankCode,
        accountNumber: recipient.accountNumber || body.accountNumber,
        accountName: recipient.accountName || resolved.accountName,
        paystackRecipientCode: recipient.recipientCode
      }
    },
    { new: true }
  ).select('bankCode accountNumber accountName paystackRecipientCode')

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
