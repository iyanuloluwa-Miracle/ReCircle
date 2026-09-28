import { createHmac, timingSafeEqual } from 'node:crypto'

/** Whole naira → kobo for Paystack amounts. */
export function nairaToKobo(naira: number) {
  if (!Number.isFinite(naira) || naira < 0) throw new Error('Invalid naira amount')
  return Math.round(naira * 100)
}

/** @deprecated Prefer withdrawReferenceForId — kept for reading old transfer refs. */
export function transferReferenceForRequest(requestId: string) {
  return `recircle_${requestId}`
}

export function topUpReferenceForId(topUpId: string) {
  return `topup_${topUpId}`
}

export function withdrawReferenceForId(withdrawalId: string) {
  return `withdraw_${withdrawalId}`
}


/** Verify Paystack webhook HMAC SHA512 over the raw request body. */
export function verifyPaystackSignature(rawBody: string | Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false
  const digest = createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    const left = Buffer.from(digest, 'utf8')
    const right = Buffer.from(signature, 'utf8')
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}
