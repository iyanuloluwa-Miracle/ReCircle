import { Types } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { User } from '../models/User'
import { LedgerEntry } from '../models/LedgerEntry'
import { TopUp } from '../models/TopUp'
import { Withdrawal } from '../models/Withdrawal'
import { WasteItem } from '../models/WasteItem'
import { listRequestsForActor } from './pickup-requests'
import { computeRecyclingStreak, formatPickupArea } from '../../utils/dashboard-metrics'
import type { AuthUser } from '../../types'


const ACTIVE_REQUEST_STATUSES = ['pending', 'accepted', 'picked_up'] as const
const COLLECTION_QUEUE_STATUSES = ['pending', 'accepted', 'picked_up'] as const

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

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
  const unfinishedScanStatuses = ['draft', 'analyzed', 'matched'] as const
  const [requests, wasteAgg, userDoc, completedDates, unfinishedScans] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'user' }),
    WasteItem.aggregate<{ totalKg: number }>([
      { $match: { userId, status: { $in: ['picked_up', 'completed'] }, weightKg: { $gt: 0 } } },
      { $group: { _id: null, totalKg: { $sum: '$weightKg' } } }
    ]),
    User.findById(userId).select('walletAvailable').lean(),
    Request.find({ userId, status: 'completed', completedAt: { $ne: null } }).select('completedAt').lean(),
    WasteItem.find({ userId, status: { $in: unfinishedScanStatuses } }).sort({ createdAt: -1 }).limit(6)
      .select('imageUrl itemName materialCode status weightKg estimatedValueMin estimatedValueMax createdAt')
      .lean()
  ])

  const lifetimeEarned = await LedgerEntry.aggregate<{ total: number }>([
    { $match: { ownerType: 'user', ownerId: userId, type: 'settle_credit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
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
      walletAvailableNgn: Math.round(userDoc?.walletAvailable ?? 0),
      totalEarnedNgn: Math.round(lifetimeEarned[0]?.total ?? 0),
      activePickups: activePickups.length,
      recyclingStreakDays: streak
    },
    activePickups,
    unfinishedScans: unfinishedScans.map(entry => ({
      id: entry._id.toString(),
      imageUrl: entry.imageUrl,
      itemName: entry.itemName ?? null,
      materialCode: entry.materialCode ?? null,
      status: entry.status,
      weightKg: entry.weightKg ?? null,
      estimatedValueMin: entry.estimatedValueMin ?? null,
      estimatedValueMax: entry.estimatedValueMax ?? null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
    }))
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
        completedCollections: 0,
        walletAvailableNgn: 0,
        walletReservedNgn: 0
      },
      incoming: [],
      acceptedPickups: [],
      capacity: null
    }
  }

  const recyclerId = profile._id
  const today = startOfUtcDay()
  const [requests, jobsToday, completedCollections] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'recycler' }),
    Request.countDocuments({
      recyclerId,
      createdAt: { $gte: today },
      status: { $nin: ['cancelled', 'rejected'] }
    }),
    Request.countDocuments({ recyclerId, status: 'completed' })
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
      acceptedMaterials: profile.acceptedMaterials,
      pricingRules: profile.pricingRules,
      serviceRadiusKm: profile.serviceRadiusKm,
      capacityKgPerDay: profile.capacityKgPerDay,
      businessHours: profile.businessHours ?? '',
      operatingHours: profile.operatingHours ?? [],
      contactPhone: profile.contactPhone ?? null,
      walletAvailable: Math.round(profile.walletAvailable ?? 0),
      walletReserved: Math.round(profile.walletReserved ?? 0)
    },
    metrics: {
      availableSupplyKg,
      jobsToday,
      potentialPurchaseValueNgn,
      completedCollections,
      walletAvailableNgn: Math.round(profile.walletAvailable ?? 0),
      walletReservedNgn: Math.round(profile.walletReserved ?? 0)
    },
    incoming,
    acceptedPickups,
    capacity: {
      capacityKgPerDay: profile.capacityKgPerDay,
      currentLoadKg: profile.currentLoadKg,
      remainingCapacityKg,
      utilizationPct
    }
  }
}

export async function getAdminDashboard(user: AuthUser) {
  const today = startOfUtcDay()
  const [
    requests,
    activePickups,
    awaitingKg,
    completedToday,
    settledAgg,
    reservedAgg,
    failedTopUps,
    failedWithdrawals,
    statusDistribution,
    recyclerUtilization,
    recentActivity
  ] = await Promise.all([
    listRequestsForActor({ userId: user.id, role: 'admin' }),
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
    LedgerEntry.aggregate<{ total: number }>([
      { $match: { type: 'settle_credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Recycler.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$walletReserved', 0] } } } }
    ]),
    TopUp.countDocuments({ status: 'failed' }),
    Withdrawal.countDocuments({ status: 'failed' }),
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
      walletAvailable: number
      walletReserved: number
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
          walletAvailable: { $ifNull: ['$walletAvailable', 0] },
          walletReserved: { $ifNull: ['$walletReserved', 0] },
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
      totalSettledNgn: Math.round(settledAgg[0]?.total ?? 0),
      reservedTotalNgn: Math.round(reservedAgg[0]?.total ?? 0),
      failedTopUps,
      failedWithdrawals
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
        lockedPayout: entry.lockedPayout ?? null,
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
      openJobs: entry.openJobs,
      walletAvailable: Math.round(entry.walletAvailable ?? 0),
      walletReserved: Math.round(entry.walletReserved ?? 0)
    })),
    collectionQueue
  }
}

