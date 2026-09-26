import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALL_NIGERIA_ZONE_ID,
  buildCollectionBatches,
  clusterNearbyPickups,
  filterPickupsByZone,
  haversineKm,
  nearestAreaName,
  nearestNeighbourSequence,
  pathDistanceKm,
  type BatchPickupPoint
} from '../utils/collection-batch.ts'

function pickup(partial: Partial<BatchPickupPoint> & Pick<BatchPickupPoint, 'id' | 'latitude' | 'longitude'>): BatchPickupPoint {
  return {
    weightKg: 5,
    expectedPayout: 400,
    status: 'pending',
    materialCode: 'PET',
    ...partial
  }
}

test('haversine distance is symmetric and zero for identical points', () => {
  const a = { latitude: 6.5095, longitude: 3.3889 }
  const b = { latitude: 6.5512, longitude: 3.3891 }
  assert.equal(haversineKm(a, a), 0)
  assert.ok(Math.abs(haversineKm(a, b) - haversineKm(b, a)) < 1e-9)
  assert.ok(haversineKm(a, b) > 4 && haversineKm(a, b) < 6)
})

test('nearest area label picks the closest demo area', () => {
  assert.equal(nearestAreaName({ latitude: 6.5095, longitude: 3.3889 }), 'Yaba')
  assert.equal(nearestAreaName({ latitude: 6.5512, longitude: 3.3891 }), 'Gbagada')
})

test('zone filter keeps only pickups inside the selected radius', () => {
  const points = [
    pickup({ id: 'yaba', latitude: 6.5095, longitude: 3.3889 }),
    pickup({ id: 'lekki', latitude: 6.4474, longitude: 3.4767 })
  ]
  const yabaOnly = filterPickupsByZone(points, 'yaba')
  assert.equal(yabaOnly.length, 1)
  assert.equal(yabaOnly[0]!.id, 'yaba')
  assert.equal(filterPickupsByZone(points, ALL_NIGERIA_ZONE_ID).length, 2)
})

test('nearest-neighbour sequence is deterministic and shortens naive id order', () => {
  const points = [
    pickup({ id: 'c', latitude: 6.5355, longitude: 3.3955 }), // Bariga
    pickup({ id: 'a', latitude: 6.5095, longitude: 3.3889 }), // Yaba
    pickup({ id: 'b', latitude: 6.5178, longitude: 3.3898 }), // Akoka
    pickup({ id: 'd', latitude: 6.5512, longitude: 3.3891 }) // Gbagada
  ]
  const naive = [...points].sort((left, right) => left.id.localeCompare(right.id))
  const suggested = nearestNeighbourSequence(points)
  assert.equal(suggested.length, 4)
  assert.equal(suggested[0]!.id, 'a') // westernmost / earliest
  assert.ok(pathDistanceKm(suggested) <= pathDistanceKm(naive) + 1e-9)
  assert.deepEqual(
    nearestNeighbourSequence(points).map(entry => entry.id),
    suggested.map(entry => entry.id)
  )
})

test('clustering separates far pickups into different batches', () => {
  const points = [
    pickup({ id: '1', latitude: 6.5095, longitude: 3.3889 }),
    pickup({ id: '2', latitude: 6.5110, longitude: 3.3900 }),
    pickup({ id: '3', latitude: 6.4474, longitude: 3.4767 })
  ]
  const clusters = clusterNearbyPickups(points, 3)
  assert.equal(clusters.length, 2)
  assert.ok(clusters.some(cluster => cluster.length === 2))
  assert.ok(clusters.some(cluster => cluster.length === 1))
})

test('buildCollectionBatches returns suggested sequence labels and distance comparison', () => {
  const points = [
    pickup({ id: 'r1', latitude: 6.5095, longitude: 3.3889, weightKg: 4, expectedPayout: 800, status: 'pending' }),
    pickup({ id: 'r2', latitude: 6.5055, longitude: 3.3795, weightKg: 6, expectedPayout: 1200, status: 'accepted' }),
    pickup({ id: 'r3', latitude: 6.5178, longitude: 3.3898, weightKg: 5, expectedPayout: 1000, status: 'pending' }),
    pickup({ id: 'r4', latitude: 6.4474, longitude: 3.4767, weightKg: 10, expectedPayout: 2000, status: 'picked_up' })
  ]
  const batches = buildCollectionBatches(points, { zoneId: ALL_NIGERIA_ZONE_ID, clusterRadiusKm: 4 })
  assert.ok(batches.length >= 1)
  const main = batches.find(batch => batch.pickupCount >= 2) ?? batches[0]!
  assert.ok(main.batchNumber >= 100)
  assert.ok(main.suggestedSequenceLabels.length === main.pickupCount)
  assert.equal(main.totalWeightKg, main.suggestedOrder.reduce((sum, stop) => sum + stop.weightKg, 0))
  assert.ok(main.suggestedDistanceKm <= main.naiveDistanceKm + 1e-9)
  assert.ok(!batches.some(batch => batch.suggestedOrder.some(stop => stop.status === 'picked_up')))
})
