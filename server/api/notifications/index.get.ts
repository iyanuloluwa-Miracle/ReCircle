import { defineEventHandler } from 'h3'
import { listNotifications } from '../../services/notifications'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const notifications = await listNotifications(user.id)
  return { notifications, unreadCount: notifications.filter(entry => !entry.readAt).length }
})
