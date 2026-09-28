import { createError, defineEventHandler, getHeader, readRawBody } from 'h3'
import {
  getPaystackSecretOrNull,
  verifyPaystackSignature
} from '../../services/paystack'
import { applyTopUpFromWebhook, applyWithdrawWebhook } from '../../services/wallet'
import { connectDatabase } from '../../utils/db'

interface PaystackWebhookEvent {
  event?: string
  data?: {
    reference?: string
    transfer_code?: string
    status?: string
    reason?: string
    message?: string
    amount?: number
    metadata?: { type?: string; topUpId?: string }
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

  let payload: PaystackWebhookEvent
  try {
    payload = JSON.parse(bodyBuffer.toString('utf8')) as PaystackWebhookEvent
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body' })
  }

  const eventName = payload.event
  const reference = payload.data?.reference
  if (!eventName || !reference) return { received: true }

  await connectDatabase()

  if (eventName === 'charge.success') {
    await applyTopUpFromWebhook({
      reference,
      amountKobo: typeof payload.data?.amount === 'number' ? payload.data.amount : undefined
    })
    return { received: true }
  }

  if (eventName === 'transfer.success' || eventName === 'transfer.failed' || eventName === 'transfer.reversed') {
    await applyWithdrawWebhook({
      reference,
      event: eventName,
      reason: payload.data?.reason || payload.data?.message
    })
    return { received: true }
  }

  return { received: true }
})
