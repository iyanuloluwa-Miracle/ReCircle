import { materialsMatch, toCanonicalMaterialCode } from './material-codes.ts'

export interface MatchCandidate {
  id: string
  businessName: string
  distanceKm: number
  pricePerKg: number
  currency: 'NGN'
  capacityKgPerDay: number
  currentLoadKg: number
  availability: 'available' | 'busy' | 'offline'
  acceptedMaterials: string[]
  serviceRadiusKm: number
  withinServiceRadius: boolean
}

export interface ScoredMatch {
  recyclerId: string
  businessName: string
  distanceKm: number
  pricePerKg: number
  currency: 'NGN'
  expectedPayout: number
  matchScore: number
  remainingCapacityKg: number
  capacityAvailablePct: number
  withinServiceRadius: boolean
  reasons: string[]
  whySelected: string[]
}

export interface EligibleRecyclerInput {
  id: string
  businessName: string
  distanceKm: number
  capacityKgPerDay: number
  currentLoadKg: number
  availability: 'available' | 'busy' | 'offline'
  acceptedMaterials: string[]
  pricingRules: Array<{ material: string; pricePerKg: number; currency?: string }>
  serviceRadiusKm: number
}

const DISTANCE_WEIGHT = 40
const PRICE_WEIGHT = 35
const CAPACITY_WEIGHT = 25

export function remainingCapacityKg(capacityKgPerDay: number, currentLoadKg: number) {
  return Math.max(0, capacityKgPerDay - currentLoadKg)
}

export function capacityAvailablePct(capacityKgPerDay: number, currentLoadKg: number) {
  if (capacityKgPerDay <= 0) return 0
  return (remainingCapacityKg(capacityKgPerDay, currentLoadKg) / capacityKgPerDay) * 100
}

export function findPricePerKg(
  pricingRules: Array<{ material: string; pricePerKg: number }>,
  materialCode: string
): number | null {
  const rule = pricingRules.find(entry => materialsMatch(materialCode, entry.material))
  if (!rule || !Number.isFinite(rule.pricePerKg) || rule.pricePerKg < 0) return null
  return rule.pricePerKg
}

/** Filter recyclers that can accept this load for the given material. */
export function filterEligibleRecyclers(
  recyclers: EligibleRecyclerInput[],
  materialCode: string,
  weightKg: number
): MatchCandidate[] {
  const canonical = toCanonicalMaterialCode(materialCode)
  if (canonical === 'UNKNOWN') return []
  if (!(weightKg > 0) || !Number.isFinite(weightKg)) return []

  const eligible: MatchCandidate[] = []
  for (const recycler of recyclers) {
    if (recycler.availability !== 'available') continue
    if (!recycler.acceptedMaterials.some(material => materialsMatch(canonical, material))) continue
    const remaining = remainingCapacityKg(recycler.capacityKgPerDay, recycler.currentLoadKg)
    if (remaining < weightKg) continue
    const pricePerKg = findPricePerKg(recycler.pricingRules, canonical)
    if (pricePerKg == null) continue
    eligible.push({
      id: recycler.id,
      businessName: recycler.businessName,
      distanceKm: recycler.distanceKm,
      pricePerKg,
      currency: 'NGN',
      capacityKgPerDay: recycler.capacityKgPerDay,
      currentLoadKg: recycler.currentLoadKg,
      availability: recycler.availability,
      acceptedMaterials: recycler.acceptedMaterials,
      serviceRadiusKm: recycler.serviceRadiusKm,
      withinServiceRadius: Number.isFinite(recycler.serviceRadiusKm)
        && recycler.distanceKm <= recycler.serviceRadiusKm
    })
  }
  return eligible
}

function normalizeHigherIsBetter(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max <= min) return 1
  return (value - min) / (max - min)
}

function normalizeLowerIsBetter(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max <= min) return 1
  return 1 - (value - min) / (max - min)
}

function formatDistance(distanceKm: number) {
  const rounded = distanceKm < 10 ? Math.round(distanceKm * 10) / 10 : Math.round(distanceKm)
  return `${rounded} km away`
}

function formatPrice(pricePerKg: number) {
  return `Pays NGN ${Math.round(pricePerKg).toLocaleString('en-NG')}/kg`
}

function formatCapacity(pct: number) {
  return `${Math.round(pct)}% daily capacity available`
}

function buildReasons(candidate: MatchCandidate, materialCode: string): string[] {
  const pct = capacityAvailablePct(candidate.capacityKgPerDay, candidate.currentLoadKg)
  const reasons = [
    formatDistance(candidate.distanceKm),
    formatPrice(candidate.pricePerKg),
    `Currently accepting ${toCanonicalMaterialCode(materialCode)}`,
    formatCapacity(pct)
  ]
  if (!candidate.withinServiceRadius) reasons.push('Outside their usual service area')
  return reasons
}

function buildWhySelected(
  scored: Omit<ScoredMatch, 'whySelected'>,
  pool: Array<Omit<ScoredMatch, 'whySelected'>>
): string[] {
  const why: string[] = []
  const withinPool = pool.filter(entry => entry.withinServiceRadius)
  const distancePeers = withinPool.length > 0 ? withinPool : pool
  const closest = Math.min(...distancePeers.map(entry => entry.distanceKm))
  const bestPrice = Math.max(...pool.map(entry => entry.pricePerKg))
  const mostCapacity = Math.max(...pool.map(entry => entry.capacityAvailablePct))

  if (!scored.withinServiceRadius) why.push('Outside their usual service area')
  else if (scored.distanceKm === closest) why.push('Closest eligible recycler')
  else if (scored.distanceKm <= closest * 1.25) why.push('Nearby eligible recycler')

  if (scored.pricePerKg === bestPrice) why.push('Highest offered price')
  else if (scored.pricePerKg >= bestPrice * 0.9) why.push('Competitive price')

  if (scored.capacityAvailablePct === mostCapacity) why.push('Most available capacity')
  else if (scored.capacityAvailablePct >= 50) why.push('Available capacity')

  if (why.length === 0) why.push('Balanced distance, price, and capacity')
  return why
}

/** Score eligible recyclers out of 100 and return them sorted best-first. */
export function scoreRecyclerMatches(
  candidates: MatchCandidate[],
  materialCode: string,
  weightKg: number
): ScoredMatch[] {
  if (candidates.length === 0 || !(weightKg > 0)) return []

  const distances = candidates.map(entry => entry.distanceKm)
  const prices = candidates.map(entry => entry.pricePerKg)
  const capacities = candidates.map(entry => capacityAvailablePct(entry.capacityKgPerDay, entry.currentLoadKg))
  const distanceMin = Math.min(...distances)
  const distanceMax = Math.max(...distances)
  const priceMin = Math.min(...prices)
  const priceMax = Math.max(...prices)
  const capacityMin = Math.min(...capacities)
  const capacityMax = Math.max(...capacities)

  const scored = candidates.map((candidate) => {
    const capacityPct = capacityAvailablePct(candidate.capacityKgPerDay, candidate.currentLoadKg)
    const distanceScore = DISTANCE_WEIGHT * normalizeLowerIsBetter(candidate.distanceKm, distanceMin, distanceMax)
    const priceScore = PRICE_WEIGHT * normalizeHigherIsBetter(candidate.pricePerKg, priceMin, priceMax)
    const capacityScore = CAPACITY_WEIGHT * normalizeHigherIsBetter(capacityPct, capacityMin, capacityMax)
    const matchScore = Math.round(distanceScore + priceScore + capacityScore)
    return {
      recyclerId: candidate.id,
      businessName: candidate.businessName,
      distanceKm: Math.round(candidate.distanceKm * 1000) / 1000,
      pricePerKg: candidate.pricePerKg,
      currency: 'NGN' as const,
      expectedPayout: Math.round(weightKg * candidate.pricePerKg * 100) / 100,
      matchScore,
      remainingCapacityKg: remainingCapacityKg(candidate.capacityKgPerDay, candidate.currentLoadKg),
      capacityAvailablePct: Math.round(capacityPct * 10) / 10,
      withinServiceRadius: candidate.withinServiceRadius,
      reasons: buildReasons(candidate, materialCode),
      whySelected: [] as string[]
    }
  })

  scored.sort((a, b) =>
    b.matchScore - a.matchScore
    || Number(b.withinServiceRadius) - Number(a.withinServiceRadius)
    || a.distanceKm - b.distanceKm
    || b.pricePerKg - a.pricePerKg
  )

  return scored.map(entry => ({
    ...entry,
    whySelected: buildWhySelected(entry, scored)
  }))
}

export function estimateValueRange(matches: Array<{ expectedPayout: number }>) {
  if (matches.length === 0) return { estimatedValueMin: null as number | null, estimatedValueMax: null as number | null }
  const payouts = matches.map(entry => entry.expectedPayout)
  return {
    estimatedValueMin: Math.min(...payouts),
    estimatedValueMax: Math.max(...payouts)
  }
}

export function topMatches(matches: ScoredMatch[], limit = 3) {
  return matches.slice(0, limit)
}
