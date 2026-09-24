import { Types } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { Transaction } from '../models/Transaction'
import { WasteItem } from '../models/WasteItem'
import { haversineKm } from '../../utils/collection-batch'
import type { AssistantFactBundle } from '../../utils/ai-assistant'
import type { AuthUser } from '../../types'
import type { GeoPoint } from '../models/shared'

function asPoint(value: unknown): GeoPoint | null {
  if (!value || typeof value !== 'object') return null
  const point = value as GeoPoint
  if (point.type !== 'Point' || !Array.isArray(point.coordinates) || point.coordinates.length < 2) return null
  const [lng, lat] = point.coordinates
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return point
}

function mapItem(entry: {
  _id: Types.ObjectId
  itemName?: string | null
  materialCode?: string | null
  recyclability?: string | null
  confidence?: number | null
  status: string
  weightKg?: number | null
  estimatedValueMin?: number | null
  estimatedValueMax?: number | null
  preparationInstructions?: string[]
  disposalMethod?: string | null
}): AssistantFactBundle['recentItems'][number] {
  return {
    id: entry._id.toString(),
    itemName: entry.itemName ?? null,
    materialCode: entry.materialCode ?? null,
    recyclability: entry.recyclability ?? null,
    confidence: entry.confidence ?? null,
    status: entry.status,
    weightKg: entry.weightKg ?? null,
    estimatedValueMin: entry.estimatedValueMin ?? null,
    estimatedValueMax: entry.estimatedValueMax ?? null,
    preparationInstructions: entry.preparationInstructions ?? [],
    disposalMethod: entry.disposalMethod ?? null
  }
}

async function mapRequests(
  recentRequests: Array<{
    _id: Types.ObjectId
    wasteItemId: Types.ObjectId
    recyclerId: Types.ObjectId
    status: string
    distanceKm: number
    pricePerKg: number
    expectedPayout: number
  }>
) {
  const requestWasteIds = recentRequests.map(entry => entry.wasteItemId)
  const requestRecyclers = [...new Set(recentRequests.map(entry => entry.recyclerId.toString()))]
  const [requestWaste, requestRecyclerDocs] = await Promise.all([
    WasteItem.find({ _id: { $in: requestWasteIds } }).select('materialCode weightKg').lean(),
    Recycler.find({ _id: { $in: requestRecyclers } }).select('businessName').lean()
  ])
  const wasteById = new Map(requestWaste.map(entry => [entry._id.toString(), entry]))
  const recyclerNameById = new Map(requestRecyclerDocs.map(entry => [entry._id.toString(), entry.businessName]))
  return recentRequests.map((entry) => {
    const waste = wasteById.get(entry.wasteItemId.toString())
    return {
      id: entry._id.toString(),
      status: entry.status,
      businessName: recyclerNameById.get(entry.recyclerId.toString()) ?? null,
      materialCode: waste?.materialCode ?? null,
      distanceKm: entry.distanceKm,
      pricePerKg: entry.pricePerKg,
      expectedPayout: entry.expectedPayout,
      weightKg: waste?.weightKg ?? null
    }
  })
}

function pricingFromRecyclers(
  recyclers: Array<{
    businessName: string
    availability: string
    pricingRules?: Array<{ material: string; pricePerKg: number }>
    location?: unknown
  }>,
  userPoint: GeoPoint | null
) {
  return recyclers.flatMap((recycler) => {
    const location = asPoint(recycler.location)
    const distanceKm = userPoint && location
      ? Math.round(haversineKm(
        { latitude: userPoint.coordinates[1], longitude: userPoint.coordinates[0] },
        { latitude: location.coordinates[1], longitude: location.coordinates[0] }
      ) * 100) / 100
      : null
    return (recycler.pricingRules ?? []).map(rule => ({
      businessName: recycler.businessName,
      availability: recycler.availability,
      material: rule.material,
      pricePerKg: rule.pricePerKg,
      distanceKm
    }))
  })
}

async function loadConsumerFacts(user: AuthUser, wasteItemId?: string, requestId?: string): Promise<AssistantFactBundle> {
  const userId = new Types.ObjectId(user.id)
  const userPoint = asPoint(user.location)

  const [recentItems, recentRequests, transactions, recyclers, materials] = await Promise.all([
    WasteItem.find({ userId }).sort({ createdAt: -1 }).limit(8)
      .select('itemName materialCode recyclability confidence status weightKg estimatedValueMin estimatedValueMax preparationInstructions disposalMethod')
      .lean(),
    Request.find({ userId }).sort({ createdAt: -1 }).limit(8).lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(8).select('amount status createdAt').lean(),
    Recycler.find({ availability: { $in: ['available', 'busy'] } })
      .select('businessName availability pricingRules location')
      .limit(20)
      .lean(),
    Request.aggregate<{ materialCode: string; weightKg: number }>([
      { $match: { userId, status: 'completed' } },
      {
        $lookup: {
          from: 'wasteitems',
          localField: 'wasteItemId',
          foreignField: '_id',
          as: 'waste'
        }
      },
      { $unwind: { path: '$waste', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$waste.materialCode', 'UNKNOWN'] },
          weightKg: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, materialCode: '$_id', weightKg: 1 } },
      { $sort: { weightKg: -1 } }
    ])
  ])

  const mappedRequests = await mapRequests(recentRequests)
  const mappedItems = recentItems.map(mapItem)

  let focusedItem = mappedItems.find(entry => entry.id === wasteItemId) ?? null
  if (!focusedItem && wasteItemId && Types.ObjectId.isValid(wasteItemId)) {
    const item = await WasteItem.findOne({ _id: wasteItemId, userId })
      .select('itemName materialCode recyclability confidence status weightKg estimatedValueMin estimatedValueMax preparationInstructions disposalMethod')
      .lean()
    if (item) focusedItem = mapItem(item)
  }

  const focusedRequest = mappedRequests.find(entry => entry.id === requestId) ?? null
  const totalCompletedPayoutNgn = Math.round(
    transactions.filter(entry => entry.status === 'completed').reduce((sum, entry) => sum + entry.amount, 0)
  )

  return {
    role: 'user',
    generatedAt: new Date().toISOString(),
    materialsRecycled: materials.map(entry => ({
      materialCode: entry.materialCode,
      weightKg: Math.round(entry.weightKg * 100) / 100
    })),
    recentItems: mappedItems,
    recentRequests: mappedRequests,
    earnings: {
      totalCompletedPayoutNgn,
      recentTransactions: transactions.map(entry => ({
        amount: entry.amount,
        status: entry.status,
        createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
      }))
    },
    recyclerPricing: pricingFromRecyclers(recyclers, userPoint),
    focusedItem,
    focusedRequest
  }
}

async function loadRecyclerFacts(user: AuthUser, requestId?: string): Promise<AssistantFactBundle> {
  const userId = new Types.ObjectId(user.id)
  const profile = await Recycler.findOne({ userId }).lean()
  if (!profile) {
    return {
      role: 'recycler',
      generatedAt: new Date().toISOString(),
      materialsRecycled: [],
      recentItems: [],
      recentRequests: [],
      earnings: { totalCompletedPayoutNgn: 0, recentTransactions: [] },
      recyclerPricing: [],
      focusedItem: null,
      focusedRequest: null
    }
  }

  const recentRequests = await Request.find({ recyclerId: profile._id }).sort({ createdAt: -1 }).limit(10).lean()
  const mappedRequests = await mapRequests(recentRequests)
  const materials = await Request.aggregate<{ materialCode: string; weightKg: number }>([
    { $match: { recyclerId: profile._id, status: 'completed' } },
    {
      $lookup: {
        from: 'wasteitems',
        localField: 'wasteItemId',
        foreignField: '_id',
        as: 'waste'
      }
    },
    { $unwind: { path: '$waste', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$waste.materialCode', 'UNKNOWN'] },
        weightKg: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
      }
    },
    { $project: { _id: 0, materialCode: '$_id', weightKg: 1 } },
    { $sort: { weightKg: -1 } }
  ])

  const completedPayout = mappedRequests
    .filter(entry => entry.status === 'completed')
    .reduce((sum, entry) => sum + entry.expectedPayout, 0)

  return {
    role: 'recycler',
    generatedAt: new Date().toISOString(),
    materialsRecycled: materials.map(entry => ({
      materialCode: entry.materialCode,
      weightKg: Math.round(entry.weightKg * 100) / 100
    })),
    recentItems: [],
    recentRequests: mappedRequests,
    earnings: {
      totalCompletedPayoutNgn: Math.round(completedPayout),
      recentTransactions: []
    },
    recyclerPricing: (profile.pricingRules ?? []).map(rule => ({
      businessName: profile.businessName,
      availability: profile.availability,
      material: rule.material,
      pricePerKg: rule.pricePerKg,
      distanceKm: null
    })),
    focusedItem: null,
    focusedRequest: mappedRequests.find(entry => entry.id === requestId) ?? null
  }
}

async function loadOperatorFacts(user: AuthUser, requestId?: string): Promise<AssistantFactBundle> {
  const userPoint = asPoint(user.location)
  const [recentRequests, recyclers, materials] = await Promise.all([
    Request.find({ status: { $in: ['pending', 'accepted', 'picked_up'] } }).sort({ createdAt: -1 }).limit(12).lean(),
    Recycler.find({}).select('businessName availability pricingRules location').limit(20).lean(),
    Request.aggregate<{ materialCode: string; weightKg: number }>([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'wasteitems',
          localField: 'wasteItemId',
          foreignField: '_id',
          as: 'waste'
        }
      },
      { $unwind: { path: '$waste', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$waste.materialCode', 'UNKNOWN'] },
          weightKg: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, materialCode: '$_id', weightKg: 1 } },
      { $sort: { weightKg: -1 } },
      { $limit: 8 }
    ])
  ])

  const mappedRequests = await mapRequests(recentRequests)
  return {
    role: 'admin',
    generatedAt: new Date().toISOString(),
    materialsRecycled: materials.map(entry => ({
      materialCode: entry.materialCode,
      weightKg: Math.round(entry.weightKg * 100) / 100
    })),
    recentItems: [],
    recentRequests: mappedRequests,
    earnings: { totalCompletedPayoutNgn: 0, recentTransactions: [] },
    recyclerPricing: pricingFromRecyclers(recyclers, userPoint),
    focusedItem: null,
    focusedRequest: mappedRequests.find(entry => entry.id === requestId) ?? null
  }
}

/** Load MongoDB facts the assistant is allowed to cite. Never invents operational numbers. */
export async function loadAssistantFacts(options: {
  user: AuthUser
  wasteItemId?: string
  requestId?: string
}): Promise<AssistantFactBundle> {
  if (options.user.role === 'recycler') {
    return loadRecyclerFacts(options.user, options.requestId)
  }
  if (options.user.role === 'admin') {
    return loadOperatorFacts(options.user, options.requestId)
  }
  return loadConsumerFacts(options.user, options.wasteItemId, options.requestId)
}
