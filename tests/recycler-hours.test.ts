import assert from 'node:assert/strict'
import test from 'node:test'
import { isOpenForMatching, normalizeOperatingHours } from '../utils/recycler-hours.ts'

test('legacy recycler hours default to Monday through Saturday daytime', () => {
  const hours = normalizeOperatingHours(undefined)
  assert.equal(hours.length, 7)
  assert.equal(hours[0]?.enabled, false)
  assert.equal(hours[1]?.open, '09:00')
})

test('matching respects enabled days and WAT opening window', () => {
  const hours = normalizeOperatingHours(undefined)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-02T10:00:00+01:00')), true)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-02T18:00:00+01:00')), false)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-01T10:00:00+01:00')), false)
})
