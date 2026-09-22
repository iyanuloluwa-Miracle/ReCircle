import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assistantSystemPrompt,
  buildGroundedUserPrompt,
  type AssistantFactBundle
} from '../utils/ai-assistant.ts'

const sampleFacts: AssistantFactBundle = {
  role: 'user',
  generatedAt: '2026-09-22T08:00:00.000Z',
  materialsRecycled: [{ materialCode: 'PET', weightKg: 12.5 }],
  recentItems: [{
    id: 'item1',
    itemName: 'Clear bottle',
    materialCode: 'PET',
    recyclability: 'high',
    confidence: 0.91,
    status: 'matched',
    weightKg: 1.2,
    estimatedValueMin: 180,
    estimatedValueMax: 240,
    preparationInstructions: ['Rinse and dry', 'Remove caps if mixed plastic'],
    disposalMethod: 'Recycle as PET'
  }],
  recentRequests: [{
    id: 'req1',
    status: 'pending',
    businessName: 'Demo Recycler',
    materialCode: 'PET',
    distanceKm: 3.4,
    pricePerKg: 150,
    expectedPayout: 180,
    weightKg: 1.2
  }],
  earnings: {
    totalCompletedPayoutNgn: 4200,
    recentTransactions: [{ amount: 180, status: 'completed', createdAt: '2026-09-20T10:00:00.000Z' }]
  },
  recyclerPricing: [{
    businessName: 'Demo Recycler',
    availability: 'available',
    material: 'PET',
    pricePerKg: 150,
    distanceKm: 3.4
  }],
  focusedItem: null,
  focusedRequest: null
}

test('assistant system prompt forbids inventing operational facts', () => {
  for (const phrase of [
    'recycler pricing',
    'pickup availability',
    'user\'s earnings',
    'transaction status',
    'recycler distance',
    'classification confidence'
  ]) {
    assert.match(assistantSystemPrompt, new RegExp(phrase, 'i'))
  }
  assert.match(assistantSystemPrompt, /From your Recykle data/i)
  assert.match(assistantSystemPrompt, /General recycling advice/i)
})

test('grounded prompt embeds MongoDB facts JSON for the model', () => {
  const prompt = buildGroundedUserPrompt({
    message: 'How can I earn more?',
    facts: sampleFacts
  })
  assert.match(prompt, /FACTS \(MongoDB/)
  assert.match(prompt, /"materialCode": "PET"/)
  assert.match(prompt, /"pricePerKg": 150/)
  assert.match(prompt, /"totalCompletedPayoutNgn": 4200/)
  assert.match(prompt, /How can I earn more\?/)
  assert.doesNotMatch(prompt, /invent a higher price/i)
})
