/** Deterministic geo helpers for Smart Collection Batch (straight-line km only). */

export interface BatchPickupPoint {
  id: string
  latitude: number
  longitude: number
  weightKg: number
  expectedPayout: number
  materialCode?: string | null
  itemName?: string | null
  status: string
  businessName?: string | null
  /** Optional label override; otherwise nearest named area is used. */
  areaLabel?: string | null
}

export interface NamedArea {
  id: string
  name: string
  latitude: number
  longitude: number
  /** Inclusion radius for zone filtering (km). */
  radiusKm: number
}

/** Demo areas for zone filters and sequence labels (sample African cities). */
export const nigeriaAreas: NamedArea[] = [
  { id: 'yaba', name: 'Yaba', latitude: 6.5095, longitude: 3.3889, radiusKm: 3.5 },
  { id: 'sabo', name: 'Sabo', latitude: 6.5055, longitude: 3.3795, radiusKm: 2.5 },
  { id: 'akoka', name: 'Akoka', latitude: 6.5178, longitude: 3.3898, radiusKm: 2.5 },
  { id: 'bariga', name: 'Bariga', latitude: 6.5355, longitude: 3.3955, radiusKm: 3 },
  { id: 'gbagada', name: 'Gbagada', latitude: 6.5512, longitude: 3.3891, radiusKm: 3.5 },
  { id: 'surulere', name: 'Surulere', latitude: 6.4979, longitude: 3.3572, radiusKm: 4 },
  { id: 'ikeja', name: 'Ikeja', latitude: 6.6018, longitude: 3.3426, radiusKm: 5 },
  { id: 'lekki', name: 'Lekki', latitude: 6.4474, longitude: 3.4767, radiusKm: 6 },
  { id: 'abuja', name: 'Abuja', latitude: 9.0765, longitude: 7.3986, radiusKm: 8 },
  { id: 'ibadan', name: 'Ibadan', latitude: 7.3775, longitude: 3.9470, radiusKm: 7 },
  { id: 'port_harcourt', name: 'Port Harcourt', latitude: 4.8156, longitude: 7.0498, radiusKm: 7 }
]

export const ALL_NIGERIA_ZONE_ID = 'all_nigeria'

const EARTH_RADIUS_KM = 6371

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function nearestAreaName(
  point: { latitude: number; longitude: number },
  areas: NamedArea[] = nigeriaAreas
) {
  if (areas.length === 0) return 'Unknown area'
  let best = areas[0]!
  let bestDistance = haversineKm(point, best)
  for (const area of areas.slice(1)) {
    const distance = haversineKm(point, area)
    if (distance < bestDistance) {
      best = area
      bestDistance = distance
    }
  }
  return best.name
}

export function filterPickupsByZone(
  pickups: BatchPickupPoint[],
  zoneId: string,
  areas: NamedArea[] = nigeriaAreas
) {
  if (zoneId === ALL_NIGERIA_ZONE_ID || !zoneId) return [...pickups]
  const zone = areas.find(area => area.id === zoneId)
  if (!zone) return []
  return pickups.filter(pickup => haversineKm(pickup, zone) <= zone.radiusKm)
}

/** Path length for an ordered list (open path — does not return to start). */
export function pathDistanceKm(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1]!, points[i]!)
  }
  return Math.round(total * 100) / 100
}

/**
 * Nearest-neighbour open path starting from the westernmost point
 * (then southernmost on ties) for a stable, deterministic tour.
 */
export function nearestNeighbourSequence<T extends { latitude: number; longitude: number }>(points: T[]): T[] {
  if (points.length <= 1) return [...points]
  const remaining = [...points]
  remaining.sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude || 0)
  const route: T[] = [remaining.shift()!]
  while (remaining.length > 0) {
    const current = route[route.length - 1]!
    let bestIndex = 0
    let bestDistance = haversineKm(current, remaining[0]!)
    for (let i = 1; i < remaining.length; i++) {
      const distance = haversineKm(current, remaining[i]!)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    route.push(remaining.splice(bestIndex, 1)[0]!)
  }
  return route
}

/**
 * Greedy geographic clustering: seed uncovered pickups in stable id order,
 * grow each batch with points within clusterRadiusKm of the cluster centroid.
 */
export function clusterNearbyPickups(
  pickups: BatchPickupPoint[],
  clusterRadiusKm = 4
): BatchPickupPoint[][] {
  if (pickups.length === 0) return []
  const sorted = [...pickups].sort((a, b) => a.id.localeCompare(b.id))
  const unused = new Set(sorted.map(entry => entry.id))
  const byId = new Map(sorted.map(entry => [entry.id, entry]))
  const clusters: BatchPickupPoint[][] = []

  for (const seed of sorted) {
    if (!unused.has(seed.id)) continue
    const cluster: BatchPickupPoint[] = [seed]
    unused.delete(seed.id)

    let grew = true
    while (grew) {
      grew = false
      const centroid = {
        latitude: cluster.reduce((sum, entry) => sum + entry.latitude, 0) / cluster.length,
        longitude: cluster.reduce((sum, entry) => sum + entry.longitude, 0) / cluster.length
      }
      for (const id of [...unused]) {
        const candidate = byId.get(id)!
        if (haversineKm(centroid, candidate) <= clusterRadiusKm) {
          cluster.push(candidate)
          unused.delete(id)
          grew = true
        }
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

export interface CollectionBatchStop {
  order: number
  requestId: string
  areaLabel: string
  latitude: number
  longitude: number
  weightKg: number
  expectedPayout: number
  materialCode: string | null
  itemName: string | null
  status: string
  businessName: string | null
}

export interface CollectionBatch {
  batchNumber: number
  pickupCount: number
  totalWeightKg: number
  estimatedRecyclerValueNgn: number
  suggestedOrder: CollectionBatchStop[]
  suggestedSequenceLabels: string[]
  naiveDistanceKm: number
  suggestedDistanceKm: number
  distanceSavedKm: number
}

function stableBatchNumber(requestIds: string[]) {
  const key = [...requestIds].sort().join('|')
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  return (Math.abs(hash) % 900) + 100
}

function toStop(point: BatchPickupPoint, order: number, areas: NamedArea[]): CollectionBatchStop {
  return {
    order,
    requestId: point.id,
    areaLabel: point.areaLabel || nearestAreaName(point, areas),
    latitude: point.latitude,
    longitude: point.longitude,
    weightKg: point.weightKg,
    expectedPayout: point.expectedPayout,
    materialCode: point.materialCode ?? null,
    itemName: point.itemName ?? null,
    status: point.status,
    businessName: point.businessName ?? null
  }
}

/** Build ordered collection batches for a zone using clustering + nearest-neighbour. */
export function buildCollectionBatches(
  pickups: BatchPickupPoint[],
  options?: { zoneId?: string; clusterRadiusKm?: number; areas?: NamedArea[] }
): CollectionBatch[] {
  const areas = options?.areas ?? nigeriaAreas
  const zoneId = options?.zoneId ?? ALL_NIGERIA_ZONE_ID
  const clusterRadiusKm = options?.clusterRadiusKm ?? 4
  const eligible = filterPickupsByZone(pickups, zoneId, areas)
    .filter(entry => entry.status === 'pending' || entry.status === 'accepted')
  const clusters = clusterNearbyPickups(eligible, clusterRadiusKm)

  return clusters.map((cluster) => {
    const naiveOrder = [...cluster].sort((a, b) => a.id.localeCompare(b.id))
    const suggested = nearestNeighbourSequence(cluster)
    const naiveDistanceKm = pathDistanceKm(naiveOrder)
    const suggestedDistanceKm = pathDistanceKm(suggested)
    const suggestedOrder = suggested.map((point, index) => toStop(point, index + 1, areas))
    const totalWeightKg = Math.round(cluster.reduce((sum, entry) => sum + entry.weightKg, 0) * 100) / 100
    const estimatedRecyclerValueNgn = Math.round(cluster.reduce((sum, entry) => sum + entry.expectedPayout, 0))

    return {
      batchNumber: stableBatchNumber(cluster.map(entry => entry.id)),
      pickupCount: cluster.length,
      totalWeightKg,
      estimatedRecyclerValueNgn,
      suggestedOrder,
      suggestedSequenceLabels: suggestedOrder.map(stop => stop.areaLabel),
      naiveDistanceKm,
      suggestedDistanceKm,
      distanceSavedKm: Math.round((naiveDistanceKm - suggestedDistanceKm) * 100) / 100
    }
  }).sort((a, b) => b.pickupCount - a.pickupCount || a.batchNumber - b.batchNumber)
}
