import { Types } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { Transaction } from '../models/Transaction'
import { nigeriaAreas, nearestAreaName } from '../../utils/collection-batch'
import type { AuthUser, UserRole } from '../../types'

export type SeriesPoint = { label: string; value: number }
export type NamedCount = { label: string; value: number; detail?: string }

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-NG', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function fillMonthSeries(rows: Array<{ month: string; value: number }>, months = 6): SeriesPoint[] {
  const map = new Map(rows.map(row => [row.month, row.value]))
  const now = new Date()
  const series: SeriesPoint[] = []
  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    series.push({ label: monthLabel(key), value: round2(map.get(key) ?? 0) })
  }
  return series
}

async function consumerAnalytics(userId: Types.ObjectId) {
  const [kgByMonth, totalPayout, materials, payoutByMonth] = await Promise.all([
    Request.aggregate<{ month: string; value: number }>([
      { $match: { userId, status: 'completed', completedAt: { $ne: null } } },
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
          _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
          value: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, month: '$_id', value: 1 } },
      { $sort: { month: 1 } }
    ]),
    Transaction.aggregate<{ total: number }>([
      { $match: { userId, status: 'completed', type: 'recycling_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Request.aggregate<{ label: string; value: number }>([
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
          value: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } }
    ]),
    Transaction.aggregate<{ month: string; value: number }>([
      { $match: { userId, status: 'completed', type: 'recycling_reward' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          value: { $sum: '$amount' }
        }
      },
      { $project: { _id: 0, month: '$_id', value: 1 } },
      { $sort: { month: 1 } }
    ])
  ])

  return {
    role: 'user' as const,
    summary: {
      totalPayoutNgn: Math.round(totalPayout[0]?.total ?? 0),
      materialsRecycled: materials.length,
      kgRecycled: round2(materials.reduce((sum, row) => sum + row.value, 0))
    },
    charts: {
      materialDistribution: materials.map(row => ({ label: row.label, value: round2(row.value) })),
      kgOverTime: fillMonthSeries(kgByMonth),
      monthlyPayouts: fillMonthSeries(payoutByMonth)
    }
  }
}

async function recyclerAnalytics(userId: Types.ObjectId) {
  const profile = await Recycler.findOne({ userId }).select('_id businessName').lean()
  if (!profile) {
    return {
      role: 'recycler' as const,
      summary: {
        valuePurchasedNgn: 0,
        averagePickupSizeKg: 0,
        completedRequests: 0
      },
      charts: {
        supplyByMaterial: [] as NamedCount[],
        completedByMonth: fillMonthSeries([]),
        monthlyPurchaseValue: fillMonthSeries([])
      }
    }
  }

  const recyclerId = profile._id
  const [supplyByMaterial, completedByMonth, valueByMonth, avgSize, valuePurchased, completedCount] = await Promise.all([
    Request.aggregate<{ label: string; value: number }>([
      { $match: { recyclerId, status: { $in: ['accepted', 'picked_up', 'completed'] } } },
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
          value: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } }
    ]),
    Request.aggregate<{ month: string; value: number }>([
      { $match: { recyclerId, status: 'completed', completedAt: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
          value: { $sum: 1 }
        }
      },
      { $project: { _id: 0, month: '$_id', value: 1 } },
      { $sort: { month: 1 } }
    ]),
    Request.aggregate<{ month: string; value: number }>([
      { $match: { recyclerId, status: 'completed', completedAt: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
          value: { $sum: '$expectedPayout' }
        }
      },
      { $project: { _id: 0, month: '$_id', value: 1 } },
      { $sort: { month: 1 } }
    ]),
    Request.aggregate<{ average: number }>([
      { $match: { recyclerId, status: 'completed' } },
      {
        $lookup: {
          from: 'wasteitems',
          localField: 'wasteItemId',
          foreignField: '_id',
          as: 'waste'
        }
      },
      { $unwind: { path: '$waste', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, average: { $avg: { $ifNull: ['$waste.weightKg', 0] } } } }
    ]),
    Request.aggregate<{ total: number }>([
      { $match: { recyclerId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$expectedPayout' } } }
    ]),
    Request.countDocuments({ recyclerId, status: 'completed' })
  ])

  return {
    role: 'recycler' as const,
    summary: {
      valuePurchasedNgn: Math.round(valuePurchased[0]?.total ?? 0),
      averagePickupSizeKg: round2(avgSize[0]?.average ?? 0),
      completedRequests: completedCount,
      businessName: profile.businessName
    },
    charts: {
      supplyByMaterial: supplyByMaterial.map(row => ({ label: row.label, value: round2(row.value) })),
      completedByMonth: fillMonthSeries(completedByMonth),
      monthlyPurchaseValue: fillMonthSeries(valueByMonth)
    }
  }
}

async function operatorAnalytics() {
  const [
    wasteByMaterial,
    statusDistribution,
    kgOverTime,
    utilization,
    totalPayouts,
    geoBuckets
  ] = await Promise.all([
    Request.aggregate<{ label: string; value: number }>([
      { $match: { status: { $in: ['accepted', 'picked_up', 'completed'] } } },
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
          value: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } }
    ]),
    Request.aggregate<{ label: string; value: number }>([
      { $group: { _id: '$status', value: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } }
    ]),
    Request.aggregate<{ month: string; value: number }>([
      { $match: { status: 'completed', completedAt: { $ne: null } } },
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
          _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
          value: { $sum: { $ifNull: ['$waste.weightKg', 0] } }
        }
      },
      { $project: { _id: 0, month: '$_id', value: 1 } },
      { $sort: { month: 1 } }
    ]),
    Recycler.aggregate<{ label: string; value: number; detail: string }>([
      {
        $project: {
          label: '$businessName',
          value: {
            $cond: [
              { $gt: ['$capacityKgPerDay', 0] },
              { $multiply: [{ $divide: ['$currentLoadKg', '$capacityKgPerDay'] }, 100] },
              0
            ]
          },
          detail: {
            $concat: [
              { $toString: { $round: ['$currentLoadKg', 1] } },
              ' / ',
              { $toString: { $round: ['$capacityKgPerDay', 1] } },
              ' kg'
            ]
          }
        }
      },
      { $sort: { value: -1 } }
    ]),
    Transaction.aggregate<{ total: number }>([
      { $match: { status: 'completed', type: 'recycling_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Request.aggregate<{ lat: number; lng: number; count: number; kg: number }>([
      { $match: { status: { $in: ['pending', 'accepted', 'picked_up', 'completed'] } } },
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
        $project: {
          lng: { $arrayElemAt: ['$pickupLocation.coordinates', 0] },
          lat: { $arrayElemAt: ['$pickupLocation.coordinates', 1] },
          weightKg: { $ifNull: ['$waste.weightKg', 0] }
        }
      },
      { $match: { lat: { $type: 'number' }, lng: { $type: 'number' } } },
      {
        $group: {
          _id: {
            lat: { $round: ['$lat', 2] },
            lng: { $round: ['$lng', 2] }
          },
          count: { $sum: 1 },
          kg: { $sum: '$weightKg' }
        }
      },
      {
        $project: {
          _id: 0,
          lat: '$_id.lat',
          lng: '$_id.lng',
          count: 1,
          kg: 1
        }
      }
    ])
  ])

  // Map reduced geo buckets (not every request) onto named Nigerian zones.
  const zoneTotals = new Map<string, number>()
  for (const bucket of geoBuckets) {
    const zone = nearestAreaName({ latitude: bucket.lat, longitude: bucket.lng }, nigeriaAreas)
    zoneTotals.set(zone, (zoneTotals.get(zone) ?? 0) + bucket.kg)
  }
  const zoneDistribution = [...zoneTotals.entries()]
    .map(([label, value]) => ({ label, value: round2(value) }))
    .sort((a, b) => b.value - a.value)

  const payoutByMonth = await Transaction.aggregate<{ month: string; value: number }>([
    { $match: { status: 'completed', type: 'recycling_reward' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        value: { $sum: '$amount' }
      }
    },
    { $project: { _id: 0, month: '$_id', value: 1 } },
    { $sort: { month: 1 } }
  ])

  return {
    role: 'admin' as const,
    summary: {
      totalPayoutsNgn: Math.round(totalPayouts[0]?.total ?? 0),
      activeStatuses: statusDistribution.filter(row => ['pending', 'accepted', 'picked_up'].includes(row.label))
        .reduce((sum, row) => sum + row.value, 0),
      kgDiverted: round2(wasteByMaterial.reduce((sum, row) => sum + row.value, 0))
    },
    charts: {
      wasteByMaterial: wasteByMaterial.map(row => ({ label: row.label, value: round2(row.value) })),
      statusDistribution: statusDistribution.map(row => ({
        label: row.label.replaceAll('_', ' '),
        value: row.value
      })),
      kgOverTime: fillMonthSeries(kgOverTime),
      monthlyPayouts: fillMonthSeries(payoutByMonth),
      recyclerUtilization: utilization.map(row => ({
        label: row.label,
        value: round2(row.value),
        detail: row.detail
      })),
      zoneDistribution
    }
  }
}

/** Role-scoped analytics aggregations. Keeps pipeline work in MongoDB. */
export const AnalyticsService = {
  async forUser(user: AuthUser) {
    const userId = new Types.ObjectId(user.id)
    if (user.role === 'user') return consumerAnalytics(userId)
    if (user.role === 'recycler') return recyclerAnalytics(userId)
    return operatorAnalytics()
  },

  supportsRole(role: UserRole) {
    return role === 'user' || role === 'recycler' || role === 'admin'
  }
}
