import { defineEventHandler } from 'h3'
import { getConsumerDashboard } from '../../services/dashboards'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user'])
  return getConsumerDashboard(user)
})
