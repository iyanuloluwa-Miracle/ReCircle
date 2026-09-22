import { defineEventHandler } from 'h3'
import { AnalyticsService } from '../services/analytics'
import { requireSessionUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user', 'recycler', 'waste_operator'])
  return AnalyticsService.forUser(user)
})
