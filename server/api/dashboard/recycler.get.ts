import { defineEventHandler } from 'h3'
import { getRecyclerDashboard } from '../../services/dashboards'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['recycler'])
  return getRecyclerDashboard(user)
})
