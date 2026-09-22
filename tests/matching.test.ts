import assert from 'node:assert/strict'
import test from 'node:test'
import { materialsMatch, toCanonicalMaterialCode, toRecyclerMaterialCodes } from '../utils/material-codes.ts'
import {
  estimateValueRange,
  filterEligibleRecyclers,
  findPricePerKg,
  scoreRecyclerMatches,
  topMatches,
  type EligibleRecyclerInput
} from '../utils/recycler-matching.ts'

function recycler(overrides: Partial<EligibleRecyclerInput> & Pick<EligibleRecyclerInput, 'id' | 'businessName'>): EligibleRecyclerInput {
  return {
    distanceKm: 3,
    capacityKgPerDay: 100,
    currentLoadKg: 20,
    availability: 'available',
    acceptedMaterials: ['pet'],
    pricingRules: [{ material: 'pet', pricePerKg: 80 }],
    serviceRadiusKm: 15,
    ...overrides
  }
}

test('material aliases bridge uppercase classifier codes to recycler catalog codes', () => {
  assert.equal(toCanonicalMaterialCode('aluminium'), 'ALUMINUM')
  assert.deepEqual(toRecyclerMaterialCodes('ALUMINUM'), ['aluminium', 'aluminum'])
  assert.ok(materialsMatch('ALUMINUM', 'aluminium'))
  assert.ok(materialsMatch('PET', 'pet'))
  assert.equal(materialsMatch('PET', 'hdpe'), false)
})

test('scoring ranks closer, higher-paying, higher-capacity recyclers', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'far-cheap', businessName: 'Far Cheap', distanceKm: 12, pricingRules: [{ material: 'pet', pricePerKg: 70 }], currentLoadKg: 80 }),
    recycler({ id: 'near-rich', businessName: 'Near Rich', distanceKm: 2, pricingRules: [{ material: 'pet', pricePerKg: 95 }], currentLoadKg: 10 }),
    recycler({ id: 'mid', businessName: 'Mid', distanceKm: 6, pricingRules: [{ material: 'pet', pricePerKg: 85 }], currentLoadKg: 40 })
  ], 'PET', 5)

  const scored = scoreRecyclerMatches(eligible, 'PET', 5)
  assert.equal(scored.length, 3)
  assert.equal(scored[0]!.recyclerId, 'near-rich')
  assert.ok(scored[0]!.matchScore >= scored[1]!.matchScore)
  assert.ok(scored[0]!.matchScore <= 100)
  assert.ok(scored[0]!.reasons.some(reason => reason.includes('km away')))
  assert.ok(scored[0]!.reasons.some(reason => reason.includes('Pays NGN')))
  assert.ok(scored[0]!.reasons.some(reason => reason.includes('Currently accepting PET')))
  assert.ok(scored[0]!.reasons.some(reason => /daily capacity available/.test(reason)))
  assert.ok(scored[0]!.whySelected.length > 0)
  assert.equal(scored[0]!.expectedPayout, 475)
})

test('top three matches and value range come from scored results', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'a', businessName: 'A', distanceKm: 1, pricingRules: [{ material: 'pet', pricePerKg: 100 }] }),
    recycler({ id: 'b', businessName: 'B', distanceKm: 2, pricingRules: [{ material: 'pet', pricePerKg: 90 }] }),
    recycler({ id: 'c', businessName: 'C', distanceKm: 3, pricingRules: [{ material: 'pet', pricePerKg: 80 }] }),
    recycler({ id: 'd', businessName: 'D', distanceKm: 4, pricingRules: [{ material: 'pet', pricePerKg: 70 }] })
  ], 'PET', 2)
  const scored = scoreRecyclerMatches(eligible, 'PET', 2)
  const top = topMatches(scored, 3)
  assert.equal(top.length, 3)
  const range = estimateValueRange(top)
  assert.equal(range.estimatedValueMin, 160)
  assert.equal(range.estimatedValueMax, 200)
})

test('no recyclers yields an empty score list', () => {
  assert.deepEqual(scoreRecyclerMatches([], 'PET', 1), [])
  assert.deepEqual(estimateValueRange([]), { estimatedValueMin: null, estimatedValueMax: null })
})

test('recycler outside service radius is ineligible', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'outside', businessName: 'Outside', distanceKm: 20, serviceRadiusKm: 10 })
  ], 'PET', 1)
  assert.equal(eligible.length, 0)
})

test('unavailable recycler is ineligible', () => {
  for (const availability of ['busy', 'offline'] as const) {
    const eligible = filterEligibleRecyclers([
      recycler({ id: availability, businessName: availability, availability })
    ], 'PET', 1)
    assert.equal(eligible.length, 0)
  }
})

test('recycler at full capacity is ineligible', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'full', businessName: 'Full', capacityKgPerDay: 50, currentLoadKg: 50 })
  ], 'PET', 1)
  assert.equal(eligible.length, 0)
})

test('remaining capacity below weight is ineligible', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'tight', businessName: 'Tight', capacityKgPerDay: 100, currentLoadKg: 96 })
  ], 'PET', 5)
  assert.equal(eligible.length, 0)
})

test('missing pricing rule excludes an otherwise eligible recycler', () => {
  const eligible = filterEligibleRecyclers([
    recycler({
      id: 'no-price',
      businessName: 'No Price',
      acceptedMaterials: ['pet'],
      pricingRules: [{ material: 'hdpe', pricePerKg: 90 }]
    })
  ], 'PET', 1)
  assert.equal(eligible.length, 0)
  assert.equal(findPricePerKg([{ material: 'hdpe', pricePerKg: 90 }], 'PET'), null)
})

test('unknown material never matches recyclers', () => {
  const eligible = filterEligibleRecyclers([
    recycler({
      id: 'unknown-acceptor',
      businessName: 'Unknown Shop',
      acceptedMaterials: ['unknown'],
      pricingRules: [{ material: 'unknown', pricePerKg: 10 }]
    })
  ], 'UNKNOWN', 2)
  assert.equal(eligible.length, 0)
})

test('aluminium alias matches ALUMINUM waste items', () => {
  const eligible = filterEligibleRecyclers([
    recycler({
      id: 'cans',
      businessName: 'Can Hub',
      acceptedMaterials: ['aluminium'],
      pricingRules: [{ material: 'aluminium', pricePerKg: 240 }]
    })
  ], 'ALUMINUM', 1)
  assert.equal(eligible.length, 1)
  assert.equal(eligible[0]!.pricePerKg, 240)
})

test('single eligible recycler receives a full normalized score of 100', () => {
  const eligible = filterEligibleRecyclers([
    recycler({ id: 'only', businessName: 'Only', distanceKm: 4.2, pricingRules: [{ material: 'pet', pricePerKg: 80 }], currentLoadKg: 18 })
  ], 'PET', 2)
  const scored = scoreRecyclerMatches(eligible, 'PET', 2)
  assert.equal(scored.length, 1)
  assert.equal(scored[0]!.matchScore, 100)
})
