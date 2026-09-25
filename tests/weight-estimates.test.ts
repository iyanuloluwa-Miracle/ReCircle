import assert from 'node:assert/strict'
import test from 'node:test'
import { estimatedWeightKg, suggestedWeightEstimate } from '../utils/weight-estimates.ts'

test('suggests a PET bottle estimate from the classified material', () => {
  assert.equal(suggestedWeightEstimate('Plastic water bottle', 'PET')?.id, 'pet-small-bottle')
})

test('calculates an editable quantity estimate in kilograms', () => {
  assert.equal(estimatedWeightKg(12, 10), 0.12)
  assert.equal(estimatedWeightKg(12, 0), null)
})
