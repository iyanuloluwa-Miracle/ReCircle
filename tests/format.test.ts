import assert from 'node:assert/strict'
import test from 'node:test'
import { formatNaira, formatNumber } from '../utils/format.ts'

test('formatNaira keeps two decimals for fractional payouts', () => {
  assert.equal(formatNaira(1.08), 'NGN 1.08')
  assert.equal(formatNaira(0.012 * 90), 'NGN 1.08')
  assert.equal(formatNaira(12.5), 'NGN 12.50')
})

test('formatNaira keeps whole amounts without trailing decimals', () => {
  assert.equal(formatNaira(80), 'NGN 80')
  assert.equal(formatNaira(475), 'NGN 475')
  assert.equal(formatNaira(0), 'NGN 0')
})

test('formatNaira tolerates non-finite input', () => {
  assert.equal(formatNaira(Number.NaN), 'NGN 0')
  assert.equal(formatNaira(Number.POSITIVE_INFINITY), 'NGN 0')
})

test('formatNumber still allows decimals', () => {
  assert.equal(formatNumber(12.5), '12.5')
})
