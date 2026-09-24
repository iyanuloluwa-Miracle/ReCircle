import { Types, type ClientSession } from 'mongoose'
import { Notification } from '../models/Notification'
import { User } from '../models/User'

export async function createNotification(input: { userId: string | Types.ObjectId; type: string; title: string; body: string; href?: string | null }) {
  await Notification.create(input)
}

/** Operational alerts are intentionally limited to exceptions and capacity risk, not every pickup event. */
export async function notifyOperators(input: { type: string; title: string; body: string; href?: string | null }, session?: ClientSession) {
  const operators = await User.find({ role: 'waste_operator' }).select('_id').session(session ?? null).lean()
  if (!operators.length) return
  await Notification.insertMany(operators.map(operator => ({ userId: operator._id, ...input })), session ? { session } : undefined)
}

export async function listNotifications(userId: string) {
  const entries = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(30).lean()
  return entries.map(entry => ({ id: entry._id.toString(), type: entry.type, title: entry.title, body: entry.body, href: entry.href ?? null, readAt: entry.readAt?.toISOString() ?? null, createdAt: entry.createdAt?.toISOString() ?? null }))
}
