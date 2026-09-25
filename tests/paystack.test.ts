import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import {
  nairaToKobo,
  transferReferenceForRequest,
  verifyPaystackSignature
} from '../utils/paystack.ts'

test('naira converts to whole kobo for Paystack', () => {
  assert.equal(nairaToKobo(0), 0)
  assert.equal(nairaToKobo(80), 8000)
  assert.equal(nairaToKobo(12.5), 1250)
  assert.throws(() => nairaToKobo(-1))
})

test('transfer references are stable per request id', () => {
  assert.equal(transferReferenceForRequest('abc123'), 'recircle_abc123')
})

test('webhook signature verification uses HMAC SHA512', () => {
  const secret = 'sk_test_example'
  const body = '{"event":"transfer.success"}'
  const signature = createHmac('sha512', secret).update(body).digest('hex')
  assert.equal(verifyPaystackSignature(body, signature, secret), true)
  assert.equal(verifyPaystackSignature(body, 'deadbeef', secret), false)
  assert.equal(verifyPaystackSignature(body, undefined, secret), false)
})
