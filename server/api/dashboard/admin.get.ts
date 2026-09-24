import { defineEventHandler } from 'h3'
import { getAdminDashboard } from '../../services/dashboards'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['admin'])
  return getAdminDashboard(user)
})
