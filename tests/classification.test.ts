import assert from 'node:assert/strict'
import test from 'node:test'
import { conservativeConfidence } from '../utils/classification.ts'

test('ambiguous classifications always trigger manual confirmation', () => {
  assert.equal(conservativeConfidence('UNKNOWN', 0.95), 0.64)
  assert.equal(conservativeConfidence('MIXED', 0.8), 0.64)
  assert.equal(conservativeConfidence('PET', 0.94), 0.94)
  assert.equal(conservativeConfidence('UNKNOWN', 0.4), 0.4)
})
