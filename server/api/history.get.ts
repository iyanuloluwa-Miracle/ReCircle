import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { WasteItem } from '../models/WasteItem'
import { listRequestsForActor } from '../services/pickup-requests'
import { requireSessionUser } from '../utils/session'

const schema = z.object({ q: z.string().trim().max(80).optional(), status: z.string().trim().max(40).optional() })
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user'])
  const parsed = schema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid history filter' })
  const query = parsed.data
  const filter: Record<string, unknown> = { userId: user.id }
  if (query.status) filter.status = query.status
  if (query.q) filter.$or = [{ itemName: { $regex: query.q, $options: 'i' } }, { materialCode: { $regex: query.q, $options: 'i' } }]
  const [items, requests] = await Promise.all([
    WasteItem.find(filter).sort({ createdAt: -1 }).limit(100).select('imageUrl itemName materialCode status weightKg createdAt').lean(),
    listRequestsForActor({ userId: user.id, role: 'user' })
  ])
  const requestMatches = query.q ? requests.filter(entry => `${entry.businessName} ${entry.itemName} ${entry.materialCode}`.toLowerCase().includes(query.q!.toLowerCase())) : requests
  return { items: items.map(item => ({ id: item._id.toString(), imageUrl: item.imageUrl, itemName: item.itemName, materialCode: item.materialCode, status: item.status, weightKg: item.weightKg, createdAt: item.createdAt?.toISOString() ?? null })), requests: requestMatches }
})
