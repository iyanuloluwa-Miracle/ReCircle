import { createError } from 'h3'
import { Types, type ClientSession } from 'mongoose'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { WasteItem } from '../models/WasteItem'
import { Notification } from '../models/Notification'
import { notifyAdmins } from './notifications'
import {
  computeLockedPayout,
  releaseRecyclerFunds,
  reserveRecyclerFunds,
  settlePickupFunds
} from './ledger'
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
  settledAt?: Date | null
  matchScore: number
  matchReasons?: string[]
  distanceKm: number
  pricePerKg: number
  expectedPayout: number
  lockedPayout?: number | null
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
  recyclerPhone?: string | null
}) {
  const settled = Boolean(doc.settledAt) || doc.status === 'completed'
  const timeline = buildRequestTimeline({
    wasteStatus: extras?.wasteStatus ?? 'matched',
    requestStatus: doc.status,
    settled,
    analyzedAt: doc.createdAt,
    matchedAt: doc.createdAt,
    requestedAt: doc.createdAt,
    acceptedAt: doc.acceptedAt,
    pickedUpAt: doc.pickedUpAt,
    completedAt: doc.completedAt,
    settledAt: doc.settledAt
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
    lockedPayout: doc.lockedPayout ?? null,
    settledAt: doc.settledAt ? new Date(doc.settledAt).toISOString() : null,
    requestedPickupTime: doc.requestedPickupTime ? new Date(doc.requestedPickupTime).toISOString() : null,
    confirmedPickupTime: doc.confirmedPickupTime ? new Date(doc.confirmedPickupTime).toISOString() : null,
    acceptedAt: doc.acceptedAt ? new Date(doc.acceptedAt).toISOString() : null,
    pickedUpAt: doc.pickedUpAt ? new Date(doc.pickedUpAt).toISOString() : null,
    completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
    rejectedAt: doc.rejectedAt ? new Date(doc.rejectedAt).toISOString() : null,
    cancelledAt: doc.cancelledAt ? new Date(doc.cancelledAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
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

async function releaseCapacityIfHeld(options: {
  request: InstanceType<typeof Request>
  recyclerId: Types.ObjectId
  weightKg: number
  session: ClientSession
}) {
  if (!options.request.capacityHeld) return
  const recycler = await Recycler.findById(options.recyclerId).session(options.session)
  if (recycler) {
    recycler.currentLoadKg = Math.max(0, (recycler.currentLoadKg ?? 0) - options.weightKg)
    await recycler.save({ session: options.session })
  }
  options.request.capacityHeld = false
}

async function unlockAfterAccept(options: {
  request: InstanceType<typeof Request>
  recyclerId: Types.ObjectId
  weightKg: number
  session: ClientSession
}) {
  const amount = options.request.lockedPayout
  if (amount != null && amount > 0 && !options.request.settledAt) {
    await releaseRecyclerFunds({
      recyclerId: options.recyclerId,
      requestId: options.request._id as Types.ObjectId,
      amount,
      session: options.session
    })
  }
  await releaseCapacityIfHeld(options)
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
    if (item.status !== 'matched' && item.status !== 'pickup_requested') {
      throw conflict('Match a recycler before requesting pickup')
    }
    if (!item.weightKg || item.weightKg <= 0) throw conflict('Weight is required before requesting pickup')
    if (!item.materialCode || !item.location?.coordinates) throw conflict('Item is missing material or location data')

    const existing = await Request.findOne({ wasteItemId }).session(session)
    const previousRecyclerId = existing?.recyclerId?.toString() ?? null
    const isPendingReassign = Boolean(existing && existing.status === 'pending')

    if (existing) {
      if (existing.status === 'pending') {
        if (previousRecyclerId === recyclerId.toString()) {
          throw conflict('That recycler is already assigned to this pickup')
        }
      } else if (existing.status !== 'cancelled' && existing.status !== 'rejected') {
        throw conflict('A pickup request already exists for this item')
      }
    } else if (item.status === 'pickup_requested') {
      throw conflict('Match a recycler before requesting pickup')
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
      settledAt: null as Date | null,
      lockedPayout: null as number | null,
      capacityHeld: false,
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

    if (isPendingReassign && previousRecyclerId && previousRecyclerId !== recyclerId.toString()) {
      const previousRecycler = await Recycler.findById(previousRecyclerId).select('userId').session(session).lean()
      if (previousRecycler) {
        await Notification.create([{
          userId: previousRecycler.userId,
          type: 'pickup_cancelled',
          title: 'Pickup reassigned',
          body: `The consumer chose another recycler for ${item.itemName || item.materialCode || 'a pickup'}.`,
          href: '/dashboard/incoming'
        }], { session })
      }
    }

    const recyclerProfile = await Recycler.findById(recyclerId).select('userId').session(session).lean()
    if (recyclerProfile) {
      await Notification.create([{
        userId: recyclerProfile.userId,
        type: 'pickup_requested',
        title: isPendingReassign ? 'Pickup reassigned to you' : 'New pickup request',
        body: `${item.itemName || item.materialCode || 'A recyclable item'} is ready for your review.`,
        href: '/dashboard/incoming'
      }], { session })
    }

    return serializeRequest(requestDoc.toObject() as RequestLean, {
      businessName: eligibleMatch.businessName,
      materialCode: item.materialCode,
      itemName: item.itemName,
      weightKg: item.weightKg,
      wasteStatus: item.status
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

  const [wasteItems, recyclers] = await Promise.all([
    WasteItem.find({ _id: { $in: wasteIds } }).select('materialCode itemName weightKg status').lean(),
    Recycler.find({ _id: { $in: recyclerIds } }).select('businessName contactPhone').lean()
  ])

  const wasteById = new Map(wasteItems.map(entry => [entry._id.toString(), entry]))
  const recyclerById = new Map(recyclers.map(entry => [entry._id.toString(), entry]))

  return requests.map((doc) => {
    const waste = wasteById.get(doc.wasteItemId.toString())
    const recycler = recyclerById.get(doc.recyclerId.toString())
    return serializeRequest(doc as RequestLean, {
      businessName: recycler?.businessName ?? null,
      materialCode: waste?.materialCode ?? null,
      itemName: waste?.itemName ?? null,
      weightKg: waste?.weightKg ?? null,
      wasteStatus: waste?.status ?? null,
      recyclerPhone: recycler?.contactPhone ?? null
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

    const previousStatus = request.status as RequestStatus

    // Authorize before revealing lifecycle details via conflict messages.
    if (options.actorRole === 'user') {
      if (request.userId.toString() !== options.actorUserId) throw notFound('Pickup request not found')
      if (nextStatus !== 'cancelled') throw forbidden('Consumers may only cancel pickups')
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

    if (!canTransitionRequest(previousStatus, nextStatus)) {
      throw conflict(`Cannot change status from ${request.status} to ${nextStatus}`)
    }

    // Claim the transition so concurrent cancel/complete cannot both apply money ops.
    const claimed = await Request.findOneAndUpdate(
      { _id: requestId, status: previousStatus },
      { $set: { status: nextStatus } },
      { session, returnDocument: 'after' }
    )
    if (!claimed) {
      throw conflict('This pickup was updated by someone else. Refresh and try again.')
    }

    const item = await WasteItem.findById(claimed.wasteItemId).session(session)
    if (!item) throw conflict('Linked waste item is missing')
    const weightKg = item.weightKg
    if (!weightKg || weightKg <= 0) throw conflict('Linked waste item is missing weight')

    const now = new Date()
    const hadMoneyLock = previousStatus === 'accepted' || previousStatus === 'picked_up'

    if (nextStatus === 'accepted') {
      const lockedPayout = computeLockedPayout(weightKg, claimed.pricePerKg)
      await reserveRecyclerFunds({
        recyclerId: claimed.recyclerId,
        requestId: claimed._id as Types.ObjectId,
        amount: lockedPayout,
        session
      })
      // Capacity is held once per accept attempt; flag prevents double-decrement later.
      if (!claimed.capacityHeld) {
        const reservedRecycler = await reserveCapacity(claimed.recyclerId, weightKg, session)
        claimed.capacityHeld = true
        if (reservedRecycler.capacityKgPerDay > 0 && reservedRecycler.currentLoadKg / reservedRecycler.capacityKgPerDay >= 0.8) {
          await notifyAdmins({ type: 'capacity_risk', title: 'Recycler capacity is nearly full', body: `${reservedRecycler.businessName} has reached at least 80% of daily capacity.`, href: '/dashboard/admin' }, session)
        }
      }
      claimed.acceptedAt = now
      claimed.lockedPayout = lockedPayout
      claimed.settledAt = null
      claimed.confirmedPickupTime = options.confirmedPickupTime ?? claimed.requestedPickupTime ?? null
    } else if (nextStatus === 'rejected') {
      if (hadMoneyLock) {
        await unlockAfterAccept({
          request: claimed,
          recyclerId: claimed.recyclerId,
          weightKg,
          session
        })
      }
      claimed.rejectedAt = now
      item.status = 'matched'
      await item.save({ session })
    } else if (nextStatus === 'cancelled') {
      if (hadMoneyLock) {
        await unlockAfterAccept({
          request: claimed,
          recyclerId: claimed.recyclerId,
          weightKg,
          session
        })
      }
      claimed.cancelledAt = now
      item.status = 'matched'
      await item.save({ session })
      const recycler = await Recycler.findById(claimed.recyclerId).select('userId businessName').session(session).lean()
      if (recycler) await Notification.create([{
        userId: recycler.userId,
        type: 'pickup_cancelled',
        title: 'Pickup cancelled',
        body: `The consumer cancelled the ${item.itemName || item.materialCode || 'pickup'} request.`,
        href: '/dashboard/incoming'
      }], { session })
      await notifyAdmins({ type: 'pickup_cancelled', title: 'Pickup cancelled', body: 'A consumer cancelled a pickup; capacity and routing may need review.', href: '/dashboard/admin' }, session)
    } else if (nextStatus === 'picked_up') {
      claimed.pickedUpAt = now
      item.status = 'picked_up'
      await item.save({ session })
    } else if (nextStatus === 'completed') {
      const lockedPayout = claimed.lockedPayout
      if (lockedPayout == null || lockedPayout <= 0) {
        throw conflict('This pickup has no locked payout to settle. Accept the request first.')
      }
      if (!claimed.settledAt) {
        await settlePickupFunds({
          recyclerId: claimed.recyclerId,
          consumerUserId: claimed.userId,
          requestId: claimed._id as Types.ObjectId,
          amount: lockedPayout,
          session
        })
        claimed.settledAt = now
      }
      await releaseCapacityIfHeld({
        request: claimed,
        recyclerId: claimed.recyclerId,
        weightKg,
        session
      })

      // Confirming collection may jump accepted → completed; still record collected time.
      if (!claimed.pickedUpAt) claimed.pickedUpAt = now
      claimed.completedAt = now
      item.status = 'completed'
      await item.save({ session })
    }

    await claimed.save({ session })

    if (options.actorRole === 'recycler') {
      const lockedLabel = claimed.lockedPayout != null
        ? `₦${Math.round(claimed.lockedPayout).toLocaleString('en-NG')}`
        : 'the reward'
      const copy: Record<string, { title: string; body: string }> = {
        accepted: {
          title: 'Pickup accepted',
          body: `${lockedLabel} is locked for your pickup.`
        },
        rejected: { title: 'Pickup unavailable', body: 'Your recycler could not accept this pickup request.' },
        picked_up: {
          title: 'Item collected',
          body: 'Your recyclable item has been collected. Your wallet will be credited when the recycler confirms completion.'
        },
        completed: {
          title: 'Collected — wallet credited',
          body: `${lockedLabel} was added to your wallet.`
        }
      }
      const message = copy[nextStatus]
      if (message) await Notification.create([{ userId: claimed.userId, type: `pickup_${nextStatus}`, ...message, href: '/dashboard/user' }], { session })
      if (nextStatus === 'rejected') await notifyAdmins({ type: 'pickup_rejected', title: 'Pickup rejected', body: 'A recycler declined a pickup. Check coverage or capacity if this repeats.', href: '/dashboard/admin' }, session)
    }

    const recycler = await Recycler.findById(claimed.recyclerId).session(session).lean()

    return serializeRequest(claimed.toObject() as RequestLean, {
      businessName: recycler?.businessName ?? null,
      materialCode: item.materialCode,
      itemName: item.itemName,
      weightKg: item.weightKg,
      wasteStatus: item.status,
      recyclerPhone: recycler?.contactPhone ?? null
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
  if (recycler) await Notification.create([{ userId: recycler.userId, type: 'pickup_rescheduled', title: 'Pickup time updated', body: 'A consumer updated their preferred pickup time.', href: '/dashboard/incoming' }])
  return serializeRequest(request.toObject() as RequestLean)
}

