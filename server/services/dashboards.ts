import { Types } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { Transaction } from '../models/Transaction'
import { WasteItem } from '../models/WasteItem'
import { listRequestsForActor } from './pickup-requests'
import { computeRecyclingStreak, formatPickupArea } from '../../utils/dashboard-metrics'
import type { AuthUser } from '../../types'

const ACTIVE_REQUEST_STATUSES = ['pending', 'accepted', 'picked_up'] as const
const COLLECTION_QUEUE_STATUSES = ['pending', 'accepted', 'picked_up'] as const

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const TIPS = [
  { title: 'Rinse before you bag', body: 'Clean, dry recyclables fetch better prices and are accepted more often.' },
  { title: 'Keep materials separate', body: 'PET, paper, and metal should travel in distinct bags when possible.' },
  { title: 'Weigh what you can', body: 'An honest kilogram estimate helps recyclers plan capacity and arrival windows.' },
  { title: 'Flag hazards early', body: 'Batteries, chemicals, and broken glass need a clear safety note before pickup.' }
] as const

async function enrichRequestsWithImages(requests: Awaited<ReturnType<typeof listRequestsForActor>>) {
  if (requests.length === 0) return []
  const wasteIds = requests.map(entry => new Types.ObjectId(entry.wasteItemId))
  const items = await WasteItem.find({ _id: { $in: wasteIds } }).select('imageUrl location').lean()
  const byId = new Map(items.map(entry => [entry._id.toString(), entry]))
  return requests.map((request) => {
    const waste = byId.get(request.wasteItemId)
    return {
      ...request,
      imageUrl: waste?.imageUrl ?? null,
      pickupArea: formatPickupArea(waste?.location ?? request.pickupLocation)
    }
  })
}

export async function getConsumerDashboard(user: AuthUser) {
  const userId = new Types.ObjectId(user.id)
  const [requests, wasteAgg, earnedAgg, completedDates, recentScans, wallet] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'user' }),
    WasteItem.aggregate<{ totalKg: number }>([
      { $match: { userId, status: { $in: ['picked_up', 'completed'] }, weightKg: { $gt: 0 } } },
      { $group: { _id: null, totalKg: { $sum: '$weightKg' } } }
    ]),
    Transaction.aggregate<{ total: number }>([
      { $match: { userId, status: 'completed', type: 'recycling_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Request.find({ userId, status: 'completed', completedAt: { $ne: null } }).select('completedAt').lean(),
    WasteItem.find({ userId }).sort({ createdAt: -1 }).limit(6)
      .select('imageUrl itemName materialCode status weightKg estimatedValueMin estimatedValueMax createdAt')
      .lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(8)
      .select('amount currency status type provider createdAt requestId')
      .lean()
  ])

  const enriched = await enrichRequestsWithImages(requests)
  const activePickups = enriched.filter(entry => (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(entry.status))
  const streak = computeRecyclingStreak(
    completedDates.map(entry => entry.completedAt!).filter(Boolean)
  )

  return {
    user,
    metrics: {
      wasteDivertedKg: Math.round((wasteAgg[0]?.totalKg ?? 0) * 100) / 100,
      totalEarnedNgn: Math.round(earnedAgg[0]?.total ?? 0),
      activePickups: activePickups.length,
      recyclingStreakDays: streak
    },
    activePickups,
    recentScans: recentScans.map(entry => ({
      id: entry._id.toString(),
      imageUrl: entry.imageUrl,
      itemName: entry.itemName ?? null,
      materialCode: entry.materialCode ?? null,
      status: entry.status,
      weightKg: entry.weightKg ?? null,
      estimatedValueMin: entry.estimatedValueMin ?? null,
      estimatedValueMax: entry.estimatedValueMax ?? null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    })),
    walletActivity: wallet.map(entry => ({
      id: entry._id.toString(),
      amount: entry.amount,
      currency: entry.currency,
      status: entry.status,
      type: entry.type,
      provider: entry.provider,
      requestId: entry.requestId.toString(),
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    })),
    tips: TIPS.map(tip => ({ ...tip }))
  }
}

export async function getRecyclerDashboard(user: AuthUser) {
  const profile = await Recycler.findOne({ userId: user.id }).lean()
  if (!profile) {
    return {
      user,
      recycler: null,
      metrics: {
        availableSupplyKg: 0,
        jobsToday: 0,
        potentialPurchaseValueNgn: 0,
        completedCollections: 0
      },
      incoming: [],
      acceptedPickups: [],
      materialBreakdown: [],
      capacity: null
    }
  }

  const recyclerId = profile._id
  const today = startOfUtcDay()
  const [requests, jobsToday, completedCollections, materialBreakdown] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'recycler' }),
    Request.countDocuments({
      recyclerId,
      createdAt: { $gte: today },
      status: { $nin: ['cancelled', 'rejected'] }
    }),
    Request.countDocuments({ recyclerId, status: 'completed' }),
    Request.aggregate<{ materialCode: string; weightKg: number; count: number; valueNgn: number }>([
      { $match: { recyclerId, status: { $in: ['accepted', 'picked_up', 'completed'] } } },
      {
        $lookup: {
          from: 'wasteitems',
          localField: 'wasteItemId',
          foreignField: '_id',
          as: 'waste'
        }
      },
      { $unwind: '$waste' },
      {
        $group: {
          _id: '$waste.materialCode',
          weightKg: { $sum: { $ifNull: ['$waste.weightKg', 0] } },
          count: { $sum: 1 },
          valueNgn: { $sum: '$expectedPayout' }
        }
      },
      { $project: { _id: 0, materialCode: { $ifNull: ['$_id', 'UNKNOWN'] }, weightKg: 1, count: 1, valueNgn: 1 } },
      { $sort: { weightKg: -1 } }
    ])
  ])

  const enriched = await enrichRequestsWithImages(requests)
  const incoming = enriched.filter(entry => entry.status === 'pending')
  const acceptedPickups = enriched.filter(entry => entry.status === 'accepted' || entry.status === 'picked_up')
  const availableSupplyKg = Math.round(
    incoming.reduce((sum, entry) => sum + (entry.weightKg ?? 0), 0) * 100
  ) / 100
  const potentialPurchaseValueNgn = Math.round(
    incoming.reduce((sum, entry) => sum + entry.expectedPayout, 0)
  )
  const remainingCapacityKg = Math.max(0, profile.capacityKgPerDay - profile.currentLoadKg)
  const utilizationPct = profile.capacityKgPerDay > 0
    ? Math.round((profile.currentLoadKg / profile.capacityKgPerDay) * 1000) / 10
    : 0

  return {
    user,
    recycler: {
      id: profile._id.toString(),
      businessName: profile.businessName,
      availability: profile.availability,
      acceptedMaterials: profile.acceptedMaterials
    },
    metrics: {
      availableSupplyKg,
      jobsToday,
      potentialPurchaseValueNgn,
      completedCollections
    },
    incoming,
    acceptedPickups,
    materialBreakdown: materialBreakdown.map(entry => ({
      materialCode: entry.materialCode,
      weightKg: Math.round(entry.weightKg * 100) / 100,
      count: entry.count,
      valueNgn: Math.round(entry.valueNgn)
    })),
    capacity: {
      capacityKgPerDay: profile.capacityKgPerDay,
      currentLoadKg: profile.currentLoadKg,
      remainingCapacityKg,
      utilizationPct
    }
  }
}

export async function getOperatorDashboard(user: AuthUser) {
  const today = startOfUtcDay()
  const [
    requests,
    activePickups,
    awaitingKg,
    completedToday,
    totalPayouts,
    statusDistribution,
    recyclerUtilization,
    recentActivity
  ] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'waste_operator' }),
    Request.countDocuments({ status: { $in: [...ACTIVE_REQUEST_STATUSES] } }),
    Request.aggregate<{ totalKg: number }>([
      { $match: { status: { $in: [...COLLECTION_QUEUE_STATUSES] } } },
      {
        $lookup: {
          from: 'wasteitems',
          localField: 'wasteItemId',
          foreignField: '_id',
          as: 'waste'
        }
      },
      { $unwind: { path: '$waste', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, totalKg: { $sum: { $ifNull: ['$waste.weightKg', 0] } } } }
    ]),
    Request.countDocuments({ status: 'completed', completedAt: { $gte: today } }),
    Transaction.aggregate<{ total: number }>([
      { $match: { status: 'completed', type: 'recycling_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Request.aggregate<{ status: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ]),
    Recycler.aggregate<{
      recyclerId: Types.ObjectId
      businessName: string
      capacityKgPerDay: number
      currentLoadKg: number
      availability: string
      openJobs: number
    }>([
      {
        $lookup: {
          from: 'requests',
          let: { rid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$recyclerId', '$$rid'] },
                    { $in: ['$status', [...ACTIVE_REQUEST_STATUSES]] }
                  ]
                }
              }
            },
            { $count: 'openJobs' }
          ],
          as: 'jobs'
        }
      },
      {
        $project: {
          recyclerId: '$_id',
          businessName: 1,
          capacityKgPerDay: 1,
          currentLoadKg: 1,
          availability: 1,
          openJobs: { $ifNull: [{ $arrayElemAt: ['$jobs.openJobs', 0] }, 0] }
        }
      },
      { $sort: { currentLoadKg: -1 } }
    ]),
    Request.find().sort({ updatedAt: -1 }).limit(10).lean()
  ])

  const enriched = await enrichRequestsWithImages(requests)
  const collectionQueue = enriched.filter(entry =>
    (COLLECTION_QUEUE_STATUSES as readonly string[]).includes(entry.status)
  )

  const activityRecyclerIds = [...new Set(recentActivity.map(entry => entry.recyclerId.toString()))]
    .map(id => new Types.ObjectId(id))
  const activityWasteIds = recentActivity.map(entry => entry.wasteItemId)
  const [activityRecyclers, activityWaste] = await Promise.all([
    Recycler.find({ _id: { $in: activityRecyclerIds } }).select('businessName').lean(),
    WasteItem.find({ _id: { $in: activityWasteIds } }).select('itemName materialCode weightKg').lean()
  ])
  const recyclerNameById = new Map(activityRecyclers.map(entry => [entry._id.toString(), entry.businessName]))
  const wasteById = new Map(activityWaste.map(entry => [entry._id.toString(), entry]))

  return {
    user,
    metrics: {
      activePickups,
      kgAwaitingCollection: Math.round((awaitingKg[0]?.totalKg ?? 0) * 100) / 100,
      completedToday,
      totalPayoutsNgn: Math.round(totalPayouts[0]?.total ?? 0)
    },
    statusDistribution,
    recentActivity: recentActivity.map((entry) => {
      const waste = wasteById.get(entry.wasteItemId.toString())
      return {
        id: entry._id.toString(),
        status: entry.status,
        businessName: recyclerNameById.get(entry.recyclerId.toString()) ?? 'Recycler',
        itemName: waste?.itemName ?? null,
        materialCode: waste?.materialCode ?? null,
        weightKg: waste?.weightKg ?? null,
        expectedPayout: entry.expectedPayout,
        updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null
      }
    }),
    recyclerUtilization: recyclerUtilization.map(entry => ({
      recyclerId: entry.recyclerId.toString(),
      businessName: entry.businessName,
      capacityKgPerDay: entry.capacityKgPerDay,
      currentLoadKg: entry.currentLoadKg,
      remainingCapacityKg: Math.max(0, entry.capacityKgPerDay - entry.currentLoadKg),
      utilizationPct: entry.capacityKgPerDay > 0
        ? Math.round((entry.currentLoadKg / entry.capacityKgPerDay) * 1000) / 10
        : 0,
      availability: entry.availability,
      openJobs: entry.openJobs
    })),
    collectionQueue
  }
}
