import { createError } from 'h3'
import { Types, type ClientSession } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { Transaction } from '../models/Transaction'
import { WasteItem } from '../models/WasteItem'
import { Notification } from '../models/Notification'
import { notifyAdmins } from './notifications'
import { withMongoTransaction } from '../utils/db'
import { matchRecyclersForWaste } from './recycler-matching'
import {
  buildRequestTimeline,
  canTransitionRequest,
  toDisplayMatchScore,
  toStoredMatchScore,
  type RequestStatus
} from '../../utils/request-lifecycle'
import type { UserRole } from '../../types'

function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: message })
}

function notFound(message: string) {
  return createError({ statusCode: 404, statusMessage: message })
}

function forbidden(message = 'You cannot perform this action') {
  return createError({ statusCode: 403, statusMessage: message })
}

type RequestLean = {
  _id: Types.ObjectId
  wasteItemId: Types.ObjectId
  userId: Types.ObjectId
  recyclerId: Types.ObjectId
  pickupLocation: { type: 'Point'; coordinates: [number, number] }
  requestedPickupTime?: Date | null
  confirmedPickupTime?: Date | null
  acceptedAt?: Date | null
  pickedUpAt?: Date | null
  completedAt?: Date | null
  rejectedAt?: Date | null
  cancelledAt?: Date | null
  matchScore: number
  matchReasons?: string[]
  distanceKm: number
  pricePerKg: number
  expectedPayout: number
  status: RequestStatus
  isDemo?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export function serializeRequest(doc: RequestLean, extras?: {
  businessName?: string | null
  materialCode?: string | null
  itemName?: string | null
  weightKg?: number | null
  wasteStatus?: string | null
  transactionStatus?: 'pending' | 'completed' | 'failed' | null
  transactionId?: string | null
  transactionCreatedAt?: Date | string | null
  recyclerPhone?: string | null
}) {
  const timeline = buildRequestTimeline({
    wasteStatus: extras?.wasteStatus ?? 'matched',
    requestStatus: doc.status,
    transactionStatus: extras?.transactionStatus ?? (doc.status === 'completed' ? 'completed' : null),
    analyzedAt: doc.createdAt,
    matchedAt: doc.createdAt,
    requestedAt: doc.createdAt,
    acceptedAt: doc.acceptedAt,
    pickedUpAt: doc.pickedUpAt,
    completedAt: doc.completedAt,
    paidAt: extras?.transactionCreatedAt ?? doc.completedAt
  })

  return {
    id: doc._id.toString(),
    wasteItemId: doc.wasteItemId.toString(),
    userId: doc.userId.toString(),
    recyclerId: doc.recyclerId.toString(),
    businessName: extras?.businessName ?? null,
    materialCode: extras?.materialCode ?? null,
    itemName: extras?.itemName ?? null,
    weightKg: extras?.weightKg ?? null,
    wasteStatus: extras?.wasteStatus ?? null,
    pickupLocation: doc.pickupLocation,
    status: doc.status,
    matchScore: toDisplayMatchScore(doc.matchScore),
    matchReasons: doc.matchReasons ?? [],
    distanceKm: doc.distanceKm,
    pricePerKg: doc.pricePerKg,
    expectedPayout: doc.expectedPayout,
    requestedPickupTime: doc.requestedPickupTime ? new Date(doc.requestedPickupTime).toISOString() : null,
    confirmedPickupTime: doc.confirmedPickupTime ? new Date(doc.confirmedPickupTime).toISOString() : null,
    acceptedAt: doc.acceptedAt ? new Date(doc.acceptedAt).toISOString() : null,
    pickedUpAt: doc.pickedUpAt ? new Date(doc.pickedUpAt).toISOString() : null,
    completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
    rejectedAt: doc.rejectedAt ? new Date(doc.rejectedAt).toISOString() : null,
    cancelledAt: doc.cancelledAt ? new Date(doc.cancelledAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    transactionId: extras?.transactionId ?? null,
    transactionStatus: extras?.transactionStatus ?? null,
    recyclerPhone: extras?.recyclerPhone ?? null,
    timeline,
    isDemo: doc.isDemo ?? false
  }
}

async function reserveCapacity(recyclerId: Types.ObjectId, weightKg: number, session: ClientSession) {
  const updated = await Recycler.findOneAndUpdate(
    {
      _id: recyclerId,
      $expr: {
        $lte: [{ $add: ['$currentLoadKg', weightKg] }, '$capacityKgPerDay']
      }
    },
    { $inc: { currentLoadKg: weightKg } },
    { session, returnDocument: 'after', runValidators: true }
  )
  if (!updated) throw conflict('Recycler does not have enough remaining capacity')
  return updated
}

export async function createPickupRequest(options: {
  userId: string
  wasteItemId: string
  recyclerId: string
  requestedPickupTime?: Date | null
  isDemo?: boolean
}) {
  const wasteItemId = new Types.ObjectId(options.wasteItemId)
  const recyclerId = new Types.ObjectId(options.recyclerId)
  const userId = new Types.ObjectId(options.userId)

  return withMongoTransaction(async (session) => {
    const item = await WasteItem.findOne({ _id: wasteItemId, userId }).session(session)
    if (!item) throw notFound('Waste item not found')
    if (item.status !== 'matched') throw conflict('Match a recycler before requesting pickup')
    if (!item.weightKg || item.weightKg <= 0) throw conflict('Weight is required before requesting pickup')
    if (!item.materialCode || !item.location?.coordinates) throw conflict('Item is missing material or location data')

    const existing = await Request.findOne({ wasteItemId }).session(session)
    if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
      throw conflict('A pickup request already exists for this item')
    }

    const match = await matchRecyclersForWaste({
      location: item.location,
      materialCode: item.materialCode,
      weightKg: item.weightKg
    })
    const eligibleMatch = match.allMatches.find(entry => entry.recyclerId === recyclerId.toString())
    if (!eligibleMatch) throw conflict('That recycler is no longer eligible for this pickup')

    const payload = {
      wasteItemId,
      userId,
      recyclerId,
      pickupLocation: item.location,
      requestedPickupTime: options.requestedPickupTime ?? null,
      confirmedPickupTime: null as Date | null,
      acceptedAt: null as Date | null,
      pickedUpAt: null as Date | null,
      completedAt: null as Date | null,
      rejectedAt: null as Date | null,
      cancelledAt: null as Date | null,
      matchScore: toStoredMatchScore(eligibleMatch.matchScore),
      matchReasons: [...eligibleMatch.whySelected, ...eligibleMatch.reasons].slice(0, 8),
      distanceKm: eligibleMatch.distanceKm,
      pricePerKg: eligibleMatch.pricePerKg,
      expectedPayout: eligibleMatch.expectedPayout,
      status: 'pending' as const,
      isDemo: options.isDemo ?? item.isDemo ?? false
    }

    let requestDoc
    if (existing) {
      existing.set(payload)
      await existing.save({ session })
      requestDoc = existing
    } else {
      const created = await Request.create([payload], { session })
      requestDoc = created[0]!
    }

    item.status = 'pickup_requested'
    await item.save({ session })
    const recyclerProfile = await Recycler.findById(recyclerId).select('userId').session(session).lean()
    if (recyclerProfile) {
      await Notification.create([{
        userId: recyclerProfile.userId,
        type: 'pickup_requested',
        title: 'New pickup request',
        body: `${item.itemName || item.materialCode || 'A recyclable item'} is ready for your review.`,
        href: '/dashboard/recycler'
      }], { session })
    }

    return serializeRequest(requestDoc.toObject() as RequestLean, {
      businessName: eligibleMatch.businessName,
      materialCode: item.materialCode,
      itemName: item.itemName,
      weightKg: item.weightKg,
      wasteStatus: item.status,
      transactionStatus: null
    })
  })
}

export async function listRequestsForActor(options: {
  userId: string
  role: UserRole
  status?: RequestStatus
}) {
  const filter: Record<string, unknown> = {}
  if (options.status) filter.status = options.status

  if (options.role === 'user') {
    filter.userId = options.userId
  } else if (options.role === 'recycler') {
    const profile = await Recycler.findOne({ userId: options.userId }).select('_id').lean()
    if (!profile) return []
    filter.recyclerId = profile._id
  } else if (options.role !== 'admin') {
    throw forbidden()
  }

  const requests = await Request.find(filter).sort({ createdAt: -1 }).lean()
  if (requests.length === 0) return []

  const wasteIds = requests.map(entry => entry.wasteItemId)
  const recyclerIds = [...new Set(requests.map(entry => entry.recyclerId.toString()))].map(id => new Types.ObjectId(id))
  const requestIds = requests.map(entry => entry._id)

  const [wasteItems, recyclers, transactions] = await Promise.all([
    WasteItem.find({ _id: { $in: wasteIds } }).select('materialCode itemName weightKg status').lean(),
    Recycler.find({ _id: { $in: recyclerIds } }).select('businessName contactPhone').lean(),
    Transaction.find({ requestId: { $in: requestIds } }).select('requestId status createdAt').lean()
  ])

  const wasteById = new Map(wasteItems.map(entry => [entry._id.toString(), entry]))
  const recyclerById = new Map(recyclers.map(entry => [entry._id.toString(), entry]))
  const txByRequest = new Map(transactions.map(entry => [entry.requestId.toString(), entry]))

  return requests.map((doc) => {
    const waste = wasteById.get(doc.wasteItemId.toString())
    const recycler = recyclerById.get(doc.recyclerId.toString())
    const tx = txByRequest.get(doc._id.toString())
    return serializeRequest(doc as RequestLean, {
      businessName: recycler?.businessName ?? null,
      materialCode: waste?.materialCode ?? null,
      itemName: waste?.itemName ?? null,
      weightKg: waste?.weightKg ?? null,
      wasteStatus: waste?.status ?? null,
      transactionStatus: tx?.status ?? null,
      transactionId: tx?._id?.toString() ?? null,
      transactionCreatedAt: tx?.createdAt ?? null
      , recyclerPhone: recycler?.contactPhone ?? null
    })
  })
}

export async function updateRequestStatus(options: {
  requestId: string
  nextStatus: RequestStatus
  actorUserId: string
  actorRole: UserRole
  confirmedPickupTime?: Date | null
}) {
  const requestId = new Types.ObjectId(options.requestId)
  const nextStatus = options.nextStatus

  return withMongoTransaction(async (session) => {
    const request = await Request.findById(requestId).session(session)
    if (!request) throw notFound('Pickup request not found')

    if (!canTransitionRequest(request.status as RequestStatus, nextStatus)) {
      throw conflict(`Cannot change status from ${request.status} to ${nextStatus}`)
    }

    if (options.actorRole === 'user') {
      if (request.userId.toString() !== options.actorUserId) throw notFound('Pickup request not found')
      if (nextStatus !== 'cancelled') throw forbidden('Consumers may only cancel pending requests')
    } else if (options.actorRole === 'recycler') {
      const profile = await Recycler.findOne({ userId: options.actorUserId }).session(session)
      if (!profile || profile._id.toString() !== request.recyclerId.toString()) {
        throw notFound('Pickup request not found')
      }
      if (!['accepted', 'rejected', 'picked_up', 'completed'].includes(nextStatus)) {
        throw forbidden('Recyclers cannot apply that status')
      }
    } else {
      throw forbidden('Admins can view requests but cannot change status')
    }

    const item = await WasteItem.findById(request.wasteItemId).session(session)
    if (!item) throw conflict('Linked waste item is missing')
    const weightKg = item.weightKg
    if (!weightKg || weightKg <= 0) throw conflict('Linked waste item is missing weight')

    const now = new Date()

    if (nextStatus === 'accepted') {
      const reservedRecycler = await reserveCapacity(request.recyclerId, weightKg, session)
      request.status = 'accepted'
      request.acceptedAt = now
      request.confirmedPickupTime = options.confirmedPickupTime ?? request.requestedPickupTime ?? null
      if (reservedRecycler.capacityKgPerDay > 0 && reservedRecycler.currentLoadKg / reservedRecycler.capacityKgPerDay >= 0.8) {
        await notifyAdmins({ type: 'capacity_risk', title: 'Recycler capacity is nearly full', body: `${reservedRecycler.businessName} has reached at least 80% of daily capacity.`, href: '/dashboard/admin' }, session)
      }
    } else if (nextStatus === 'rejected') {
      request.status = 'rejected'
      request.rejectedAt = now
      item.status = 'matched'
      await item.save({ session })
    } else if (nextStatus === 'cancelled') {
      request.status = 'cancelled'
      request.cancelledAt = now
      item.status = 'matched'
      await item.save({ session })
      const recycler = await Recycler.findById(request.recyclerId).select('userId businessName').session(session).lean()
      if (recycler) await Notification.create([{
        userId: recycler.userId,
        type: 'pickup_cancelled',
        title: 'Pickup cancelled',
        body: `The consumer cancelled the ${item.itemName || item.materialCode || 'pickup'} request.`,
        href: '/dashboard/recycler'
      }], { session })
      await notifyAdmins({ type: 'pickup_cancelled', title: 'Pickup cancelled', body: 'A consumer cancelled a pending pickup; capacity and routing may need review.', href: '/dashboard/admin' }, session)
    } else if (nextStatus === 'picked_up') {
      request.status = 'picked_up'
      request.pickedUpAt = now
      item.status = 'picked_up'
      await item.save({ session })
    } else if (nextStatus === 'completed') {
      const recycler = await Recycler.findById(request.recyclerId).session(session)
      if (!recycler) throw conflict('Recycler profile is missing')
      if (recycler.currentLoadKg > recycler.capacityKgPerDay) {
        throw conflict('Recycler capacity is inconsistent')
      }
      await recycler.save({ session })

      request.status = 'completed'
      request.completedAt = now
      item.status = 'completed'
      await item.save({ session })

      const existingTx = await Transaction.findOne({ requestId: request._id }).session(session)
      if (!existingTx) {
        await Transaction.create([{
          userId: request.userId,
          requestId: request._id,
          amount: request.expectedPayout,
          currency: 'NGN',
          type: 'recycling_reward',
          provider: 'mock',
          status: 'completed',
          isDemo: request.isDemo ?? false
        }], { session })
      }
    }

    await request.save({ session })

    if (options.actorRole === 'recycler') {
      const copy: Record<string, { title: string; body: string }> = {
        accepted: { title: 'Pickup accepted', body: 'Your recycler accepted the pickup request. Check your confirmed pickup time.' },
        rejected: { title: 'Pickup unavailable', body: 'Your recycler could not accept this pickup request.' },
        picked_up: { title: 'Item collected', body: 'Your recyclable item has been collected.' },
        completed: { title: 'Pickup completed', body: 'Your recycling reward is now recorded.' }
      }
      const message = copy[nextStatus]
      if (message) await Notification.create([{ userId: request.userId, type: `pickup_${nextStatus}`, ...message, href: '/dashboard/user' }], { session })
      if (nextStatus === 'rejected') await notifyAdmins({ type: 'pickup_rejected', title: 'Pickup rejected', body: 'A recycler declined a pending pickup. Check coverage or capacity if this repeats.', href: '/dashboard/admin' }, session)
    }

    const [recycler, tx] = await Promise.all([
      Recycler.findById(request.recyclerId).session(session).lean(),
      Transaction.findOne({ requestId: request._id }).session(session).lean()
    ])

    return serializeRequest(request.toObject() as RequestLean, {
      businessName: recycler?.businessName ?? null,
      materialCode: item.materialCode,
      itemName: item.itemName,
      weightKg: item.weightKg,
      wasteStatus: item.status,
      transactionStatus: tx?.status ?? null,
      transactionId: tx?._id?.toString() ?? null,
      transactionCreatedAt: tx?.createdAt ?? null
      , recyclerPhone: recycler?.contactPhone ?? null
    })
  })
}

export async function reschedulePickupRequest(options: { requestId: string; userId: string; requestedPickupTime: Date }) {
  const request = await Request.findOne({ _id: options.requestId, userId: options.userId })
  if (!request) throw notFound('Pickup request not found')
  if (request.status !== 'pending') throw conflict('Only pending pickup requests can be rescheduled')
  request.requestedPickupTime = options.requestedPickupTime
  await request.save()
  const recycler = await Recycler.findById(request.recyclerId).select('userId').lean()
  if (recycler) await Notification.create([{ userId: recycler.userId, type: 'pickup_rescheduled', title: 'Pickup time updated', body: 'A consumer updated their preferred pickup time.', href: '/dashboard/recycler' }])
  return serializeRequest(request.toObject() as RequestLean)
}
