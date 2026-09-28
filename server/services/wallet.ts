import { createError } from 'h3'
import { Types } from 'mongoose'
import { Recycler } from '../models/Recycler'
import { User } from '../models/User'
import { TopUp } from '../models/TopUp'
import { Withdrawal } from '../models/Withdrawal'
import { Notification } from '../models/Notification'
import {
  creditRecyclerTopUp,
  debitConsumerWithdraw,
  listLedgerForOwner,
  restoreFailedWithdraw
} from './ledger'
import {
  initializeTransaction,
  initiateTransfer,
  isPaystackConfigured,
  topUpReferenceForId,
  withdrawReferenceForId
} from './paystack'
import { withMongoTransaction, connectDatabase } from '../utils/db'
import type { AuthUser } from '../../types'

function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: message })
}

function badRequest(message: string) {
  return createError({ statusCode: 400, statusMessage: message })
}

function roundNaira(amount: number) {
  return Math.round(amount * 100) / 100
}

export async function getWalletForUser(user: AuthUser) {
  await connectDatabase()
  if (user.role === 'recycler') {
    const profile = await Recycler.findOne({ userId: user.id })
      .select('walletAvailable walletReserved businessName')
      .lean()
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })
    const ledger = await listLedgerForOwner({
      ownerType: 'recycler',
      ownerId: profile._id,
      limit: 12
    })
    return {
      role: 'recycler' as const,
      available: roundNaira(profile.walletAvailable ?? 0),
      reserved: roundNaira(profile.walletReserved ?? 0),
      paystackEnabled: isPaystackConfigured(),
      demoTopUpAllowed: !isPaystackConfigured(),
      recent: ledger.entries
    }
  }

  if (user.role === 'user') {
    const doc = await User.findById(user.id)
      .select('walletAvailable paystackRecipientCode accountName accountNumber bankCode')
      .lean()
    if (!doc) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    const ledger = await listLedgerForOwner({
      ownerType: 'user',
      ownerId: doc._id,
      limit: 12
    })
    return {
      role: 'user' as const,
      available: roundNaira(doc.walletAvailable ?? 0),
      reserved: 0,
      hasBankAccount: Boolean(doc.paystackRecipientCode),
      accountName: doc.accountName ?? null,
      paystackEnabled: isPaystackConfigured(),
      recent: ledger.entries
    }
  }

  // Admin: network audit snapshot
  const [recyclerAgg, failedTopUps, failedWithdrawals] = await Promise.all([
    Recycler.aggregate<{ available: number; reserved: number; count: number }>([
      {
        $group: {
          _id: null,
          available: { $sum: { $ifNull: ['$walletAvailable', 0] } },
          reserved: { $sum: { $ifNull: ['$walletReserved', 0] } },
          count: { $sum: 1 }
        }
      }
    ]),
    TopUp.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10)
      .select('recyclerId amount status failureReason provider createdAt')
      .lean(),
    Withdrawal.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10)
      .select('userId amount status failureReason provider createdAt')
      .lean()
  ])
  const consumerAgg = await User.aggregate<{ available: number }>([
    { $match: { role: 'user' } },
    { $group: { _id: null, available: { $sum: { $ifNull: ['$walletAvailable', 0] } } } }
  ])

  return {
    role: 'admin' as const,
    recyclers: {
      count: recyclerAgg[0]?.count ?? 0,
      available: roundNaira(recyclerAgg[0]?.available ?? 0),
      reserved: roundNaira(recyclerAgg[0]?.reserved ?? 0)
    },
    consumers: {
      available: roundNaira(consumerAgg[0]?.available ?? 0)
    },
    failedTopUps: failedTopUps.map(entry => ({
      id: entry._id.toString(),
      recyclerId: entry.recyclerId.toString(),
      amount: entry.amount,
      failureReason: entry.failureReason ?? null,
      provider: entry.provider,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    })),
    failedWithdrawals: failedWithdrawals.map(entry => ({
      id: entry._id.toString(),
      userId: entry.userId.toString(),
      amount: entry.amount,
      failureReason: entry.failureReason ?? null,
      provider: entry.provider,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    })),
    paystackEnabled: isPaystackConfigured()
  }
}

export async function getWalletLedger(user: AuthUser, options: { limit?: number; offset?: number }) {
  await connectDatabase()
  if (user.role === 'recycler') {
    const profile = await Recycler.findOne({ userId: user.id }).select('_id').lean()
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })
    return listLedgerForOwner({
      ownerType: 'recycler',
      ownerId: profile._id,
      limit: options.limit,
      offset: options.offset
    })
  }
  if (user.role === 'user') {
    return listLedgerForOwner({
      ownerType: 'user',
      ownerId: new Types.ObjectId(user.id),
      limit: options.limit,
      offset: options.offset
    })
  }
  throw createError({ statusCode: 403, statusMessage: 'Admins use GET /api/wallet for audit totals' })
}

export async function startRecyclerTopUp(options: {
  userId: string
  email: string
  amountNaira: number
  callbackUrl?: string
}) {
  const amount = roundNaira(options.amountNaira)
  if (amount < 100) throw badRequest('Minimum top-up is ₦100')
  if (!isPaystackConfigured()) {
    throw conflict('Paystack is not configured. Use demo top-up for local testing.')
  }

  await connectDatabase()
  const profile = await Recycler.findOne({ userId: options.userId }).select('_id').lean()
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })

  const topUp = await TopUp.create({
    recyclerId: profile._id,
    amount,
    currency: 'NGN',
    status: 'pending',
    provider: 'paystack',
    providerRef: null
  })

  const reference = topUpReferenceForId(topUp._id.toString())
  topUp.providerRef = reference
  await topUp.save()

  const init = await initializeTransaction({
    email: options.email,
    amountNaira: amount,
    reference,
    callbackUrl: options.callbackUrl,
    metadata: {
      type: 'recycler_top_up',
      topUpId: topUp._id.toString(),
      recyclerId: profile._id.toString()
    }
  })

  return {
    topUpId: topUp._id.toString(),
    authorizationUrl: init.authorizationUrl,
    reference: init.reference,
    amount
  }
}

export async function demoRecyclerTopUp(options: { userId: string; amountNaira: number }) {
  if (isPaystackConfigured()) {
    throw conflict('Demo top-up is disabled while Paystack TEST keys are configured')
  }
  const amount = roundNaira(options.amountNaira)
  if (amount < 100) throw badRequest('Minimum top-up is ₦100')

  await connectDatabase()
  const profile = await Recycler.findOne({ userId: options.userId }).select('_id').lean()
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })

  return withMongoTransaction(async (session) => {
    const created = await TopUp.create([{
      recyclerId: profile._id,
      amount,
      currency: 'NGN',
      status: 'pending',
      provider: 'demo',
      providerRef: null
    }], { session })
    const topUp = created[0]
    if (!topUp) throw createError({ statusCode: 500, statusMessage: 'Could not create top-up' })

    const providerRef = `demo_topup_${topUp._id.toString()}`
    await creditRecyclerTopUp({
      recyclerId: profile._id,
      topUpId: topUp._id,
      amount,
      provider: 'demo',
      providerRef,
      session
    })

    const updated = await Recycler.findById(profile._id).session(session).lean()
    return {
      topUpId: topUp._id.toString(),
      amount,
      available: roundNaira(updated?.walletAvailable ?? 0),
      reserved: roundNaira(updated?.walletReserved ?? 0)
    }
  })
}

export async function applyTopUpFromWebhook(options: {
  reference: string
  amountKobo?: number
}) {
  const reference = options.reference
  if (!reference.startsWith('topup_')) return { handled: false as const }

  return withMongoTransaction(async (session) => {
    const topUp = await TopUp.findOne({ providerRef: reference }).session(session)
    if (!topUp) return { handled: false as const }
    if (topUp.status === 'completed') return { handled: true as const, alreadyApplied: true }

    if (options.amountKobo == null || !Number.isFinite(options.amountKobo)) {
      // Require Paystack amount so we never credit from an incomplete payload.
      return { handled: false as const }
    }

    const expectedKobo = Math.round(topUp.amount * 100)
    if (Math.abs(expectedKobo - options.amountKobo) > 1) {
      topUp.status = 'failed'
      topUp.failureReason = 'Paid amount did not match top-up amount'
      await topUp.save({ session })
      return { handled: true as const, alreadyApplied: false }
    }

    await creditRecyclerTopUp({
      recyclerId: topUp.recyclerId,
      topUpId: topUp._id,
      amount: topUp.amount,
      provider: 'paystack',
      providerRef: reference,
      session
    })

    const recycler = await Recycler.findById(topUp.recyclerId).select('userId').session(session).lean()
    if (recycler) {
      await Notification.create([{
        userId: recycler.userId,
        type: 'wallet_top_up',
        title: 'Wallet topped up',
        body: `₦${Math.round(topUp.amount).toLocaleString('en-NG')} was added to your available balance.`,
        href: '/dashboard/recycler'
      }], { session })
    }

    return { handled: true as const, alreadyApplied: false }
  })
}

export async function startConsumerWithdraw(options: {
  userId: string
  amountNaira: number
}) {
  const amount = roundNaira(options.amountNaira)
  if (amount < 100) throw badRequest('Minimum withdrawal is ₦100')

  await connectDatabase()
  const user = await User.findById(options.userId)
    .select('walletAvailable paystackRecipientCode')
    .lean()
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (!user.paystackRecipientCode) {
    throw conflict('Add a bank account in Settings before withdrawing')
  }
  if ((user.walletAvailable ?? 0) < amount) {
    throw conflict('Insufficient wallet balance for this withdrawal')
  }

  if (!isPaystackConfigured()) {
    // Local/demo: debit and mark completed without a bank Transfer
    return withMongoTransaction(async (session) => {
      const created = await Withdrawal.create([{
        userId: user._id,
        amount,
        currency: 'NGN',
        status: 'pending',
        provider: 'demo',
        providerRef: null
      }], { session })
      const withdrawal = created[0]
      if (!withdrawal) throw createError({ statusCode: 500, statusMessage: 'Could not create withdrawal' })

      const providerRef = `demo_withdraw_${withdrawal._id.toString()}`
      await debitConsumerWithdraw({
        userId: user._id,
        withdrawalId: withdrawal._id,
        amount,
        provider: 'demo',
        providerRef,
        session
      })
      await Withdrawal.updateOne(
        { _id: withdrawal._id },
        { $set: { status: 'completed', providerRef } },
        { session }
      )

      const updated = await User.findById(user._id).session(session).select('walletAvailable').lean()
      return {
        withdrawalId: withdrawal._id.toString(),
        amount,
        status: 'completed' as const,
        available: roundNaira(updated?.walletAvailable ?? 0),
        demo: true
      }
    })
  }

  const withdrawal = await Withdrawal.create({
    userId: user._id,
    amount,
    currency: 'NGN',
    status: 'pending',
    provider: 'paystack',
    providerRef: null
  })
  const reference = withdrawReferenceForId(withdrawal._id.toString())
  withdrawal.providerRef = reference
  await withdrawal.save()

  try {
    await withMongoTransaction(async (session) => {
      await debitConsumerWithdraw({
        userId: user._id,
        withdrawalId: withdrawal._id,
        amount,
        provider: 'paystack',
        providerRef: reference,
        session
      })
    })
  } catch (error) {
    await Withdrawal.updateOne(
      { _id: withdrawal._id },
      { $set: { status: 'failed', failureReason: 'Could not debit wallet' } }
    )
    throw error
  }

  try {
    const transfer = await initiateTransfer({
      amountNaira: amount,
      recipientCode: user.paystackRecipientCode,
      reference,
      reason: `ReCircle wallet withdrawal ${withdrawal._id.toString()}`
    })
    const status = transfer.status === 'success' ? 'completed' : 'pending'
    await Withdrawal.updateOne(
      { _id: withdrawal._id },
      { $set: { status, providerRef: transfer.reference || reference } }
    )
    const updated = await User.findById(user._id).select('walletAvailable').lean()
    return {
      withdrawalId: withdrawal._id.toString(),
      amount,
      status,
      available: roundNaira(updated?.walletAvailable ?? 0),
      demo: false
    }
  } catch (error) {
    const statusCode = error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 0
    const reason = error && typeof error === 'object' && 'statusMessage' in error
      ? String((error as { statusMessage?: string }).statusMessage || 'Paystack transfer failed')
      : 'Paystack transfer failed'

    // 4xx means Paystack rejected before creating a transfer — safe to restore.
    if (statusCode >= 400 && statusCode < 500) {
      await withMongoTransaction(async (session) => {
        await restoreFailedWithdraw({
          userId: user._id,
          withdrawalId: withdrawal._id,
          amount,
          failureReason: reason,
          session
        })
      })
      throw createError({ statusCode: 502, statusMessage: reason })
    }

    // Timeouts / 5xx: transfer may already exist. Keep pending for webhook.
    await Withdrawal.updateOne(
      { _id: withdrawal._id },
      {
        $set: {
          status: 'pending',
          failureReason: `Transfer initiate unclear; awaiting webhook. ${reason}`.slice(0, 280)
        }
      }
    )
    throw createError({
      statusCode: 502,
      statusMessage: 'Withdrawal submitted but bank confirmation is pending. Your balance stays reserved until Paystack confirms.'
    })
  }
}

export async function applyWithdrawWebhook(options: {
  reference: string
  event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed'
  reason?: string
}) {
  const reference = options.reference
  if (!reference.startsWith('withdraw_')) return { handled: false as const }

  return withMongoTransaction(async (session) => {
    const withdrawal = await Withdrawal.findOne({ providerRef: reference }).session(session)
    if (!withdrawal) return { handled: false as const }

    if (options.event === 'transfer.success') {
      if (withdrawal.status !== 'completed') {
        withdrawal.status = 'completed'
        withdrawal.failureReason = null
        await withdrawal.save({ session })
        await Notification.create([{
          userId: withdrawal.userId,
          type: 'withdraw_completed',
          title: 'Withdrawal sent',
          body: `₦${Math.round(withdrawal.amount).toLocaleString('en-NG')} was sent to your bank account.`,
          href: '/dashboard/user'
        }], { session })
      }
      return { handled: true as const }
    }

    if (withdrawal.status === 'failed') return { handled: true as const }
    const reason = (options.reason || 'Transfer failed').slice(0, 280)
    await restoreFailedWithdraw({
      userId: withdrawal.userId,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
      failureReason: reason,
      session
    })
    await Notification.create([{
      userId: withdrawal.userId,
      type: 'withdraw_failed',
      title: options.event === 'transfer.reversed' ? 'Withdrawal reversed' : 'Withdrawal failed',
      body: 'Your withdrawal could not be completed. The amount was returned to your wallet. Check your bank account in Settings if needed.',
      href: '/dashboard/settings'
    }], { session })
    return { handled: true as const }
  })
}
