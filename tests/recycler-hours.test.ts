import assert from 'node:assert/strict'
import test from 'node:test'
import { alwaysOpenOperatingHours, isOpenForMatching, normalizeOperatingHours } from '../utils/recycler-hours.ts'

test('legacy recycler hours default to Monday through Saturday daytime', () => {
  const hours = normalizeOperatingHours(undefined)
  assert.equal(hours.length, 7)
  assert.equal(hours[0]?.enabled, false)
  assert.equal(hours[1]?.open, '09:00')
})

test('matching stays open when no schedule is configured', () => {
  assert.equal(isOpenForMatching(undefined, new Date('2025-06-02T01:00:00+01:00')), true)
  assert.equal(isOpenForMatching(null, new Date('2025-06-02T01:00:00+01:00')), true)
  assert.equal(isOpenForMatching([], new Date('2025-06-02T01:00:00+01:00')), true)
})

test('matching respects enabled days and WAT opening window', () => {
  const hours = normalizeOperatingHours(undefined)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-02T10:00:00+01:00')), true)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-02T18:00:00+01:00')), false)
  assert.equal(isOpenForMatching(hours, new Date('2025-06-01T10:00:00+01:00')), false)
})

test('always-open demo schedule matches overnight', () => {
  assert.equal(isOpenForMatching(alwaysOpenOperatingHours, new Date('2025-06-02T01:46:00+01:00')), true)
  assert.equal(isOpenForMatching(alwaysOpenOperatingHours, new Date('2025-06-01T23:00:00+01:00')), true)
})
