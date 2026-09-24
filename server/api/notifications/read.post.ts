import { defineEventHandler } from 'h3'
import { Notification } from '../../models/Notification'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await Notification.updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } })
  return { ok: true }
})
