import { createError } from 'h3'
import { Types, type ClientSession } from 'mongoose'
import { LedgerEntry, type LedgerEntryType } from '../models/LedgerEntry'
import { Recycler } from '../models/Recycler'
import { User } from '../models/User'
import { TopUp } from '../models/TopUp'
import { Withdrawal } from '../models/Withdrawal'

function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: message })
}

function roundNaira(amount: number) {
  return Math.round(amount * 100) / 100
}

export function computeLockedPayout(weightKg: number, pricePerKg: number) {
  return roundNaira(weightKg * pricePerKg)
}

async function insertLedgerEntry(options: {
  ownerType: 'recycler' | 'user'
  ownerId: Types.ObjectId
  type: LedgerEntryType
  amount: number
  requestId?: Types.ObjectId | null
  topUpId?: Types.ObjectId | null
  withdrawalId?: Types.ObjectId | null
  provider: 'paystack' | 'demo' | 'internal'
  providerRef?: string | null
  failureReason?: string | null
  idempotencyKey: string
  session: ClientSession
}) {
  try {
    await LedgerEntry.create([{
      ownerType: options.ownerType,
      ownerId: options.ownerId,
      type: options.type,
      amount: options.amount,
      currency: 'NGN',
      requestId: options.requestId ?? null,
      topUpId: options.topUpId ?? null,
      withdrawalId: options.withdrawalId ?? null,
      provider: options.provider,
      providerRef: options.providerRef ?? null,
      failureReason: options.failureReason ?? null,
      idempotencyKey: options.idempotencyKey
    }], { session: options.session })
    return true
  } catch (error) {
    // Duplicate idempotency key → already applied
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      return false
    }
    throw error
  }
}

export async function hasLedgerEntry(idempotencyKey: string, session?: ClientSession) {
  const query = LedgerEntry.findOne({ idempotencyKey }).select('_id')
  if (session) query.session(session)
  return Boolean(await query.lean())
}

/** Latest escrow-related ledger row for a request (attempt-aware). */
async function latestEscrowOp(requestId: Types.ObjectId, session: ClientSession) {
  return LedgerEntry.findOne({
    requestId,
    type: { $in: ['reserve', 'release', 'settle_debit', 'settle_credit'] }
  })
    .sort({ createdAt: -1, _id: -1 })
    .select('type idempotencyKey amount')
    .session(session)
    .lean()
}

function attemptFromReserveKey(key: string, requestId: string) {
  // Legacy: reserve:{id}  → attempt 1
  // Versioned: reserve:{id}:{n}
  if (key === `reserve:${requestId}`) return 1
  const prefix = `reserve:${requestId}:`
  if (key.startsWith(prefix)) {
    const n = Number(key.slice(prefix.length))
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  return 1
}

function reserveKeyForAttempt(requestId: string, attempt: number) {
  return attempt <= 1 ? `reserve:${requestId}` : `reserve:${requestId}:${attempt}`
}

function releaseKeyForAttempt(requestId: string, attempt: number) {
  return attempt <= 1 ? `release:${requestId}` : `release:${requestId}:${attempt}`
}

async function nextReserveAttempt(requestId: Types.ObjectId, session: ClientSession) {
  const count = await LedgerEntry.countDocuments({
    requestId,
    type: 'reserve'
  }).session(session)
  return count + 1
}

/** Move recycler available → reserved for an accepted pickup. */
export async function reserveRecyclerFunds(options: {
  recyclerId: Types.ObjectId
  requestId: Types.ObjectId
  amount: number
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  if (amount <= 0) throw conflict('Locked payout must be positive')

  const requestKey = options.requestId.toString()
  const latest = await latestEscrowOp(options.requestId, options.session)
  if (latest?.type === 'settle_debit' || latest?.type === 'settle_credit') {
    throw conflict('This pickup was already settled and cannot be re-accepted')
  }
  // Open lock already exists (accept raced or retry) — do not lock twice.
  if (latest?.type === 'reserve') {
    return { alreadyApplied: true as const }
  }

  const attempt = await nextReserveAttempt(options.requestId, options.session)
  const key = reserveKeyForAttempt(requestKey, attempt)

  const updated = await Recycler.findOneAndUpdate(
    {
      _id: options.recyclerId,
      walletAvailable: { $gte: amount }
    },
    {
      $inc: {
        walletAvailable: -amount,
        walletReserved: amount
      }
    },
    { session: options.session, returnDocument: 'after', runValidators: true }
  )
  if (!updated) throw conflict('Insufficient wallet balance to accept this pickup. Top up your wallet first.')

  const inserted = await insertLedgerEntry({
    ownerType: 'recycler',
    ownerId: options.recyclerId,
    type: 'reserve',
    amount,
    requestId: options.requestId,
    provider: 'internal',
    idempotencyKey: key,
    session: options.session
  })
  if (!inserted) {
    await Recycler.updateOne(
      { _id: options.recyclerId },
      { $inc: { walletAvailable: amount, walletReserved: -amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  return { alreadyApplied: false as const, recycler: updated }
}

/** Return reserved funds to available on cancel/reject after accept. */
export async function releaseRecyclerFunds(options: {
  recyclerId: Types.ObjectId
  requestId: Types.ObjectId
  amount: number
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  if (amount <= 0) return { alreadyApplied: true as const }

  const requestKey = options.requestId.toString()
  const latest = await latestEscrowOp(options.requestId, options.session)
  if (!latest || latest.type !== 'reserve') {
    return { alreadyApplied: true as const }
  }

  const attempt = attemptFromReserveKey(latest.idempotencyKey, requestKey)
  const key = releaseKeyForAttempt(requestKey, attempt)
  if (await hasLedgerEntry(key, options.session)) return { alreadyApplied: true as const }

  const updated = await Recycler.findOneAndUpdate(
    {
      _id: options.recyclerId,
      walletReserved: { $gte: amount }
    },
    {
      $inc: {
        walletReserved: -amount,
        walletAvailable: amount
      }
    },
    { session: options.session, returnDocument: 'after', runValidators: true }
  )
  if (!updated) throw conflict('Could not unlock reserved wallet funds')

  const inserted = await insertLedgerEntry({
    ownerType: 'recycler',
    ownerId: options.recyclerId,
    type: 'release',
    amount,
    requestId: options.requestId,
    provider: 'internal',
    idempotencyKey: key,
    session: options.session
  })
  if (!inserted) {
    await Recycler.updateOne(
      { _id: options.recyclerId },
      { $inc: { walletReserved: amount, walletAvailable: -amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  return { alreadyApplied: false as const, recycler: updated }
}

/** Debit recycler reserved and credit consumer available on complete. */
export async function settlePickupFunds(options: {
  recyclerId: Types.ObjectId
  consumerUserId: Types.ObjectId
  requestId: Types.ObjectId
  amount: number
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  if (amount <= 0) throw conflict('Settlement amount must be positive')

  const requestKey = options.requestId.toString()
  const debitKey = `settle_debit:${requestKey}`
  const creditKey = `settle_credit:${requestKey}`

  const latest = await latestEscrowOp(options.requestId, options.session)
  if (latest?.type === 'settle_debit' || latest?.type === 'settle_credit') {
    return { alreadyApplied: true as const }
  }
  if (!latest || latest.type !== 'reserve') {
    throw conflict('No open wallet lock for this pickup. Accept the request before completing.')
  }
  // Guard against settling a different amount than what was locked for this attempt.
  if (roundNaira(latest.amount) !== amount) {
    throw conflict('Locked payout does not match the reserved amount')
  }

  if (await hasLedgerEntry(debitKey, options.session)) {
    return { alreadyApplied: true as const }
  }

  const recycler = await Recycler.findOneAndUpdate(
    {
      _id: options.recyclerId,
      walletReserved: { $gte: amount }
    },
    { $inc: { walletReserved: -amount } },
    { session: options.session, returnDocument: 'after', runValidators: true }
  )
  if (!recycler) throw conflict('Reserved funds are missing for settlement')

  const debitInserted = await insertLedgerEntry({
    ownerType: 'recycler',
    ownerId: options.recyclerId,
    type: 'settle_debit',
    amount,
    requestId: options.requestId,
    provider: 'internal',
    idempotencyKey: debitKey,
    session: options.session
  })
  if (!debitInserted) {
    await Recycler.updateOne(
      { _id: options.recyclerId },
      { $inc: { walletReserved: amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  await User.updateOne(
    { _id: options.consumerUserId },
    { $inc: { walletAvailable: amount } },
    { session: options.session }
  )

  const creditInserted = await insertLedgerEntry({
    ownerType: 'user',
    ownerId: options.consumerUserId,
    type: 'settle_credit',
    amount,
    requestId: options.requestId,
    provider: 'internal',
    idempotencyKey: creditKey,
    session: options.session
  })
  if (!creditInserted) {
    await User.updateOne(
      { _id: options.consumerUserId },
      { $inc: { walletAvailable: -amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  return { alreadyApplied: false as const }
}

/** Credit recycler available after verified top-up (webhook or demo). */
export async function creditRecyclerTopUp(options: {
  recyclerId: Types.ObjectId
  topUpId: Types.ObjectId
  amount: number
  provider: 'paystack' | 'demo'
  providerRef: string
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  if (amount <= 0) throw conflict('Top-up amount must be positive')

  const key = `top_up:${options.providerRef}`
  if (await hasLedgerEntry(key, options.session)) return { alreadyApplied: true as const }

  await Recycler.updateOne(
    { _id: options.recyclerId },
    { $inc: { walletAvailable: amount } },
    { session: options.session }
  )

  const inserted = await insertLedgerEntry({
    ownerType: 'recycler',
    ownerId: options.recyclerId,
    type: 'top_up',
    amount,
    topUpId: options.topUpId,
    provider: options.provider,
    providerRef: options.providerRef,
    idempotencyKey: key,
    session: options.session
  })
  if (!inserted) {
    await Recycler.updateOne(
      { _id: options.recyclerId },
      { $inc: { walletAvailable: -amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  await TopUp.updateOne(
    { _id: options.topUpId, status: { $ne: 'completed' } },
    { $set: { status: 'completed', providerRef: options.providerRef, failureReason: null } },
    { session: options.session }
  )

  return { alreadyApplied: false as const }
}

/** Debit consumer available and record withdraw ledger entry (before Transfer). */
export async function debitConsumerWithdraw(options: {
  userId: Types.ObjectId
  withdrawalId: Types.ObjectId
  amount: number
  provider: 'paystack' | 'demo'
  providerRef: string
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  if (amount <= 0) throw conflict('Withdraw amount must be positive')

  const key = `withdraw:${options.withdrawalId.toString()}`
  if (await hasLedgerEntry(key, options.session)) return { alreadyApplied: true as const }

  const updated = await User.findOneAndUpdate(
    {
      _id: options.userId,
      walletAvailable: { $gte: amount }
    },
    { $inc: { walletAvailable: -amount } },
    { session: options.session, returnDocument: 'after', runValidators: true }
  )
  if (!updated) throw conflict('Insufficient wallet balance for this withdrawal')

  const inserted = await insertLedgerEntry({
    ownerType: 'user',
    ownerId: options.userId,
    type: 'withdraw',
    amount,
    withdrawalId: options.withdrawalId,
    provider: options.provider,
    providerRef: options.providerRef,
    idempotencyKey: key,
    session: options.session
  })
  if (!inserted) {
    await User.updateOne(
      { _id: options.userId },
      { $inc: { walletAvailable: amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  return { alreadyApplied: false as const, user: updated }
}

/** Restore consumer available after failed/reversed Transfer. */
export async function restoreFailedWithdraw(options: {
  userId: Types.ObjectId
  withdrawalId: Types.ObjectId
  amount: number
  failureReason: string
  session: ClientSession
}) {
  const amount = roundNaira(options.amount)
  const key = `withdraw_failed:${options.withdrawalId.toString()}`
  if (await hasLedgerEntry(key, options.session)) return { alreadyApplied: true as const }
  if (!(await hasLedgerEntry(`withdraw:${options.withdrawalId.toString()}`, options.session))) {
    return { alreadyApplied: true as const }
  }

  await User.updateOne(
    { _id: options.userId },
    { $inc: { walletAvailable: amount } },
    { session: options.session }
  )

  const inserted = await insertLedgerEntry({
    ownerType: 'user',
    ownerId: options.userId,
    type: 'withdraw_failed',
    amount,
    withdrawalId: options.withdrawalId,
    provider: 'paystack',
    failureReason: options.failureReason.slice(0, 280),
    idempotencyKey: key,
    session: options.session
  })
  if (!inserted) {
    await User.updateOne(
      { _id: options.userId },
      { $inc: { walletAvailable: -amount } },
      { session: options.session }
    )
    return { alreadyApplied: true as const }
  }

  await Withdrawal.updateOne(
    { _id: options.withdrawalId },
    { $set: { status: 'failed', failureReason: options.failureReason.slice(0, 280) } },
    { session: options.session }
  )

  return { alreadyApplied: false as const }
}

export async function listLedgerForOwner(options: {
  ownerType: 'recycler' | 'user'
  ownerId: Types.ObjectId
  limit?: number
  offset?: number
}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)
  const [entries, total] = await Promise.all([
    LedgerEntry.find({ ownerType: options.ownerType, ownerId: options.ownerId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    LedgerEntry.countDocuments({ ownerType: options.ownerType, ownerId: options.ownerId })
  ])
  return {
    total,
    entries: entries.map(entry => ({
      id: entry._id.toString(),
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      requestId: entry.requestId ? entry.requestId.toString() : null,
      topUpId: entry.topUpId ? entry.topUpId.toString() : null,
      withdrawalId: entry.withdrawalId ? entry.withdrawalId.toString() : null,
      provider: entry.provider,
      providerRef: entry.providerRef ?? null,
      failureReason: entry.failureReason ?? null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    }))
  }
}
