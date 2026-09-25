import { createError, defineEventHandler, getHeader, readRawBody } from 'h3'
import { Transaction } from '../../models/Transaction'
import { Notification } from '../../models/Notification'
import {
  getPaystackSecretOrNull,
  verifyPaystackSignature
} from '../../services/paystack'
import { connectDatabase } from '../../utils/db'

interface PaystackTransferEvent {
  event?: string
  data?: {
    reference?: string
    transfer_code?: string
    status?: string
    reason?: string
    message?: string
  }
}

export default defineEventHandler(async (event) => {
  const secret = getPaystackSecretOrNull()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Paystack is not configured' })
  }

  const rawBody = await readRawBody(event)
  if (rawBody == null) {
    throw createError({ statusCode: 400, statusMessage: 'Empty webhook body' })
  }
  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody)
  if (bodyBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty webhook body' })
  }
  const signature = getHeader(event, 'x-paystack-signature')
  if (!verifyPaystackSignature(bodyBuffer, signature, secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Paystack signature' })
  }

  let payload: PaystackTransferEvent
  try {
    payload = JSON.parse(bodyBuffer.toString('utf8')) as PaystackTransferEvent
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body' })
  }

  const eventName = payload.event
  if (!eventName || !['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(eventName)) {
    return { received: true }
  }

  const reference = payload.data?.reference
  if (!reference) return { received: true }

  await connectDatabase()
  const tx = await Transaction.findOne({ provider: 'paystack', providerRef: reference })
  if (!tx) return { received: true }

  if (eventName === 'transfer.success') {
    if (tx.status !== 'completed') {
      tx.status = 'completed'
      tx.failureReason = null
      await tx.save()
      await Notification.create([{
        userId: tx.userId,
        type: 'payout_completed',
        title: 'Reward sent',
        body: 'Your recycling reward was paid via Paystack.',
        href: '/dashboard/user'
      }])
    }
  } else {
    const reason = (payload.data?.reason || payload.data?.message || 'Transfer failed').slice(0, 280)
    tx.status = 'failed'
    tx.failureReason = reason
    await tx.save()
    await Notification.create([{
      userId: tx.userId,
      type: 'payout_failed',
      title: eventName === 'transfer.reversed' ? 'Payout reversed' : 'Payout failed',
      body: 'Your recycling reward could not be completed. Update your payout bank account in Settings if needed.',
      href: '/dashboard/settings'
    }])
  }

  return { received: true }
})
