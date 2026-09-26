import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { WasteItem } from '../models/WasteItem'
import {
  ALL_NIGERIA_ZONE_ID,
  buildCollectionBatches,
  filterPickupsByZone,
  nigeriaAreas,
  type BatchPickupPoint
} from '../../utils/collection-batch'

const OPTIMIZE_STATUSES = ['pending', 'accepted'] as const

export async function optimizeCollectionBatches(options?: {
  zoneId?: string
  clusterRadiusKm?: number
}) {
  const zoneId = options?.zoneId ?? ALL_NIGERIA_ZONE_ID
  const clusterRadiusKm = options?.clusterRadiusKm ?? 4

  const requests = await Request.find({ status: { $in: [...OPTIMIZE_STATUSES] } })
    .sort({ createdAt: 1 })
    .lean()

  if (requests.length === 0) {
    return {
      zoneId,
      explanation: 'ReCircle groups nearby pickups to reduce unnecessary collection travel.',
      disclaimer: 'Straight-line estimates only — not road-routing optimization.',
      zones: [
        { id: ALL_NIGERIA_ZONE_ID, name: 'All regions' },
        ...nigeriaAreas.map(area => ({ id: area.id, name: area.name }))
      ],
      batches: [],
      pickupCount: 0
    }
  }

  const wasteIds = requests.map(entry => entry.wasteItemId)
  const recyclerIds = [...new Set(requests.map(entry => entry.recyclerId.toString()))]
  const [wasteItems, recyclers] = await Promise.all([
    WasteItem.find({ _id: { $in: wasteIds } }).select('materialCode itemName weightKg').lean(),
    Recycler.find({ _id: { $in: recyclerIds } }).select('businessName').lean()
  ])
  const wasteById = new Map(wasteItems.map(entry => [entry._id.toString(), entry]))
  const recyclerById = new Map(recyclers.map(entry => [entry._id.toString(), entry.businessName]))

  const pickups: BatchPickupPoint[] = []
  for (const request of requests) {
    const [longitude, latitude] = request.pickupLocation?.coordinates ?? []
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    const waste = wasteById.get(request.wasteItemId.toString())
    pickups.push({
      id: request._id.toString(),
      latitude,
      longitude,
      weightKg: waste?.weightKg ?? 0,
      expectedPayout: request.expectedPayout,
      materialCode: waste?.materialCode ?? null,
      itemName: waste?.itemName ?? null,
      status: request.status,
      businessName: recyclerById.get(request.recyclerId.toString()) ?? null
    })
  }

  const batches = buildCollectionBatches(pickups, { zoneId, clusterRadiusKm })
  const inZone = filterPickupsByZone(
    pickups.filter(entry => entry.status === 'pending' || entry.status === 'accepted'),
    zoneId
  )

  return {
    zoneId,
    explanation: 'ReCircle groups nearby pickups to reduce unnecessary collection travel.',
    disclaimer: 'Suggested collection sequence uses straight-line nearest-neighbour heuristics — not actual road routing.',
    zones: [
      { id: ALL_NIGERIA_ZONE_ID, name: 'All regions' },
      ...nigeriaAreas.map(area => ({ id: area.id, name: area.name }))
    ],
    batches,
    pickupCount: inZone.length
  }
}
