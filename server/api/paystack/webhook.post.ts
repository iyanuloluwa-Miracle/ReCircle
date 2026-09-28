import { createError, defineEventHandler, getHeader, readRawBody } from 'h3'
import {
  getPaystackSecretOrNull,
  verifyPaystackSignature
} from '../../services/paystack'
import { applyTopUpFromWebhook, applyWithdrawWebhook } from '../../services/wallet'
import { connectDatabase } from '../../utils/db'
import { logPayout } from '../../utils/payout-logger'

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
    logPayout('webhook.signature.invalid', 'Rejected Paystack webhook with invalid signature', {
      hasSignature: Boolean(signature),
      bodyBytes: bodyBuffer.length
    }, 'error')
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
  const amountKobo = typeof payload.data?.amount === 'number' ? payload.data.amount : undefined

  logPayout('webhook.received', 'Paystack webhook received', {
    eventName: eventName || null,
    reference: reference || null,
    amountKobo: amountKobo ?? null,
    status: payload.data?.status || null
  })

  if (!eventName || !reference) {
    logPayout('webhook.skip', 'Missing event or reference', {
      eventName: eventName || null,
      reference: reference || null
    }, 'warn')
    return { received: true }
  }

  await connectDatabase()

  try {
    if (eventName === 'charge.success') {
      const result = await applyTopUpFromWebhook({
        reference,
        amountKobo
      })
      logPayout('webhook.topup.result', 'Top-up webhook processed', {
        reference,
        handled: result.handled,
        alreadyApplied: result.alreadyApplied ?? false,
        reason: result.reason ?? null,
        amountKobo: amountKobo ?? null
      }, result.handled ? 'info' : 'warn')
      return { received: true }
    }

    if (eventName === 'transfer.success' || eventName === 'transfer.failed' || eventName === 'transfer.reversed') {
      const result = await applyWithdrawWebhook({
        reference,
        event: eventName,
        reason: payload.data?.reason || payload.data?.message
      })
      logPayout('webhook.transfer.result', 'Transfer webhook processed', {
        reference,
        eventName,
        handled: result.handled,
        reason: result.reason ?? null
      }, result.handled ? 'info' : 'warn')
      return { received: true }
    }

    logPayout('webhook.ignored', 'Unhandled Paystack event', { eventName, reference }, 'info')
    return { received: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed'
    logPayout('webhook.error', message, {
      eventName,
      reference,
      hint: message.toLowerCase().includes('replica') || message.toLowerCase().includes('transaction')
        ? 'MongoDB transactions require a replica set (Atlas or local rs).'
        : null
    }, 'error')
    throw error
  }
})
