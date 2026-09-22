import { defineEventHandler } from 'h3'
import { getOperatorDashboard } from '../../services/dashboards'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['waste_operator'])
  return getOperatorDashboard(user)
})
