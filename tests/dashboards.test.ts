import assert from 'node:assert/strict'
import test from 'node:test'
import { computeRecyclingStreak, formatPickupArea } from '../utils/dashboard-metrics.ts'

test('recycling streak counts consecutive completed days ending today or yesterday', () => {
  const now = new Date('2026-09-22T15:00:00.000Z')
  assert.equal(computeRecyclingStreak([
    new Date('2026-09-22T10:00:00.000Z'),
    new Date('2026-09-21T18:00:00.000Z'),
    new Date('2026-09-20T09:00:00.000Z')
  ], now), 3)
  assert.equal(computeRecyclingStreak([
    new Date('2026-09-21T18:00:00.000Z'),
    new Date('2026-09-20T09:00:00.000Z')
  ], now), 2)
  assert.equal(computeRecyclingStreak([
    new Date('2026-09-18T09:00:00.000Z')
  ], now), 0)
  assert.equal(computeRecyclingStreak([], now), 0)
})

test('pickup area formats GeoJSON coordinates for cards', () => {
  assert.equal(formatPickupArea({ coordinates: [3.3947, 6.4541] }), '6.454°N, 3.395°E')
  assert.equal(formatPickupArea(null), 'Pickup area unavailable')
})
