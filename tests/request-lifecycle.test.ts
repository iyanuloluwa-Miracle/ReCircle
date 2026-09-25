import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRequestTimeline,
  canTransitionRequest,
  toDisplayMatchScore,
  toStoredMatchScore
} from '../utils/request-lifecycle.ts'

test('allows only the strict pickup lifecycle transitions', () => {
  assert.equal(canTransitionRequest('pending', 'accepted'), true)
  assert.equal(canTransitionRequest('pending', 'rejected'), true)
  assert.equal(canTransitionRequest('pending', 'cancelled'), true)
  assert.equal(canTransitionRequest('accepted', 'picked_up'), true)
  assert.equal(canTransitionRequest('accepted', 'completed'), true)
  assert.equal(canTransitionRequest('picked_up', 'completed'), true)

  assert.equal(canTransitionRequest('completed', 'pending'), false)
  assert.equal(canTransitionRequest('rejected', 'picked_up'), false)
  assert.equal(canTransitionRequest('cancelled', 'accepted'), false)
  assert.equal(canTransitionRequest('accepted', 'rejected'), false)
  assert.equal(canTransitionRequest('picked_up', 'cancelled'), false)
})

test('match scores convert between UI and storage scales', () => {
  assert.equal(toStoredMatchScore(92), 0.92)
  assert.equal(toDisplayMatchScore(0.86), 86)
  assert.equal(toStoredMatchScore(150), 1)
})

test('timeline marks completed steps and leaves later ones pending', () => {
  const steps = buildRequestTimeline({
    wasteStatus: 'pickup_requested',
    requestStatus: 'accepted',
    transactionStatus: null,
    requestedAt: '2026-09-22T08:00:00.000Z',
    acceptedAt: '2026-09-22T09:00:00.000Z'
  })
  assert.equal(steps[0]!.state, 'complete')
  assert.equal(steps[1]!.state, 'complete')
  assert.equal(steps[2]!.state, 'complete')
  assert.equal(steps[3]!.state, 'complete')
  assert.equal(steps[3]!.label, 'Recycler accepted')
  assert.equal(steps[4]!.state, 'current')
  assert.equal(steps[4]!.label, 'Collected')
  assert.equal(steps[5]!.state, 'pending')
  assert.equal(steps[5]!.label, 'Payment')
})

test('collected without a transaction keeps payment pending', () => {
  const steps = buildRequestTimeline({
    wasteStatus: 'picked_up',
    requestStatus: 'picked_up',
    transactionStatus: null,
    pickedUpAt: '2026-09-22T11:00:00.000Z'
  })
  assert.equal(steps[4]!.state, 'complete')
  assert.equal(steps[4]!.label, 'Collected')
  assert.equal(steps[5]!.state, 'current')
  assert.equal(steps[5]!.label, 'Payment')
})

test('completed requests mark payment complete', () => {
  const steps = buildRequestTimeline({
    wasteStatus: 'completed',
    requestStatus: 'completed',
    transactionStatus: 'completed',
    completedAt: '2026-09-22T12:00:00.000Z',
    paidAt: '2026-09-22T12:00:00.000Z'
  })
  assert.ok(steps.every(step => step.state === 'complete'))
})

test('completed with pending paystack keeps payment current', () => {
  const steps = buildRequestTimeline({
    wasteStatus: 'completed',
    requestStatus: 'completed',
    transactionStatus: 'pending',
    completedAt: '2026-09-22T12:00:00.000Z',
    pickedUpAt: '2026-09-22T12:00:00.000Z'
  })
  assert.equal(steps[4]!.state, 'complete')
  assert.equal(steps[5]!.state, 'current')
})
