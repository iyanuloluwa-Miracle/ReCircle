import { createError } from 'h3'
import { Types } from 'mongoose'
import type { UserRole } from '../../types'
import { canSendChatMessage } from '../../utils/chat'
import type { RequestStatus } from '../../utils/request-lifecycle'
import { Message } from '../models/Message'
import { Request } from '../models/Request'
import { Recycler } from '../models/Recycler'
import { createNotification } from './notifications'

export { canSendChatMessage } from '../../utils/chat'

function notFound(message = 'Pickup request not found') {
  return createError({ statusCode: 404, statusMessage: message })
}

function forbidden(message = 'You cannot access this chat') {
  return createError({ statusCode: 403, statusMessage: message })
}

function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: message })
}

type RequestLean = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  recyclerId: Types.ObjectId
  status: RequestStatus
}

function serializeMessage(doc: {
  _id: Types.ObjectId
  requestId: Types.ObjectId
  senderUserId: Types.ObjectId
  body: string
  createdAt?: Date
}) {
  return {
    id: doc._id.toString(),
    requestId: doc.requestId.toString(),
    senderUserId: doc.senderUserId.toString(),
    body: doc.body,
    createdAt: doc.createdAt?.toISOString() ?? null
  }
}

function previewBody(body: string) {
  const trimmed = body.trim()
  if (trimmed.length <= 120) return trimmed
  return `${trimmed.slice(0, 117)}…`
}

async function loadParticipatingRequest(options: {
  requestId: string
  actorUserId: string
  actorRole: UserRole
}): Promise<RequestLean> {
  if (!Types.ObjectId.isValid(options.requestId)) throw notFound()

  const request = await Request.findById(options.requestId)
    .select('userId recyclerId status')
    .lean<RequestLean | null>()
  if (!request) throw notFound()

  if (options.actorRole === 'user') {
    if (request.userId.toString() !== options.actorUserId) throw forbidden()
    return request
  }

  if (options.actorRole === 'recycler') {
    const profile = await Recycler.findOne({ userId: options.actorUserId }).select('_id').lean()
    if (!profile || profile._id.toString() !== request.recyclerId.toString()) throw forbidden()
    return request
  }

  throw forbidden()
}

export async function listRequestMessages(options: {
  requestId: string
  actorUserId: string
  actorRole: UserRole
  after?: string | null
}) {
  const request = await loadParticipatingRequest(options)
  const filter: Record<string, unknown> = { requestId: request._id }

  if (options.after) {
    if (!Types.ObjectId.isValid(options.after)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid message cursor' })
    }
    filter._id = { $gt: new Types.ObjectId(options.after) }
  }

  const messages = await Message.find(filter).sort({ createdAt: 1, _id: 1 }).limit(200).lean()

  return {
    requestId: request._id.toString(),
    status: request.status,
    canSend: canSendChatMessage(request.status),
    messages: messages.map(serializeMessage)
  }
}

export async function sendRequestMessage(options: {
  requestId: string
  actorUserId: string
  actorRole: UserRole
  body: string
}) {
  const request = await loadParticipatingRequest(options)
  if (!canSendChatMessage(request.status)) {
    throw conflict('Chat is closed for this pickup')
  }

  const body = options.body.trim()
  if (!body) throw createError({ statusCode: 400, statusMessage: 'Message cannot be empty' })

  const created = await Message.create({
    requestId: request._id,
    senderUserId: options.actorUserId,
    body
  })

  let recipientUserId: Types.ObjectId | null = null
  let href: string | null = null

  if (options.actorRole === 'user') {
    const recycler = await Recycler.findById(request.recyclerId).select('userId').lean()
    recipientUserId = recycler?.userId ?? null
    href = `/dashboard/recycler?chat=${request._id.toString()}`
  } else {
    recipientUserId = request.userId
    href = `/dashboard/user?chat=${request._id.toString()}`
  }

  if (recipientUserId) {
    await createNotification({
      userId: recipientUserId,
      type: 'chat_message',
      title: 'New pickup message',
      body: previewBody(body),
      href
    })
  }

  return {
    requestId: request._id.toString(),
    status: request.status,
    canSend: canSendChatMessage(request.status),
    message: serializeMessage(created)
  }
}
