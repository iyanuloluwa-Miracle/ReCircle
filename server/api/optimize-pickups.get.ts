import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { optimizeCollectionBatches } from '../services/collection-batch'
import { requireSessionUser } from '../utils/session'
import { ALL_LAGOS_ZONE_ID, lagosAreas } from '../../utils/collection-batch'

const zoneIds = [ALL_LAGOS_ZONE_ID, ...lagosAreas.map(area => area.id)] as [string, ...string[]]

const querySchema = z.object({
  zoneId: z.enum(zoneIds).optional(),
  clusterRadiusKm: z.coerce.number().finite().positive().max(25).optional()
})

/** Read-only Smart Collection Batch planner for operators. Does not mutate requests. */
export default defineEventHandler(async (event) => {
  await requireSessionUser(event, ['waste_operator'])
  const parsed = querySchema.safeParse(getQuery(event))
  const zoneId = parsed.success ? parsed.data.zoneId : undefined
  const clusterRadiusKm = parsed.success ? parsed.data.clusterRadiusKm : undefined
  return optimizeCollectionBatches({ zoneId, clusterRadiusKm })
})
