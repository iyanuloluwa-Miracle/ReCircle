import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { WasteItem } from '../models/WasteItem'
import { listRequestsForActor } from '../services/pickup-requests'
import { requireSessionUser } from '../utils/session'

const PAGE_SIZE = 10

const schema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
  itemsPage: z.coerce.number().int().positive().default(1),
  requestsPage: z.coerce.number().int().positive().default(1)
})

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user'])
  const parsed = schema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid history filter' })
  const query = parsed.data
  const filter: Record<string, unknown> = { userId: user.id }
  if (query.status) filter.status = query.status
  if (query.q) filter.$or = [{ itemName: { $regex: query.q, $options: 'i' } }, { materialCode: { $regex: query.q, $options: 'i' } }]

  const [itemsTotal, requests] = await Promise.all([
    WasteItem.countDocuments(filter),
    listRequestsForActor({ userId: user.id, role: 'user' })
  ])

  const itemsPageMax = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE))
  const itemsPage = Math.min(query.itemsPage, itemsPageMax)
  const items = await WasteItem.find(filter)
    .sort({ createdAt: -1 })
    .skip((itemsPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .select('imageUrl itemName materialCode status weightKg createdAt')
    .lean()

  const requestMatches = query.q
    ? requests.filter(entry => `${entry.businessName} ${entry.itemName} ${entry.materialCode}`.toLowerCase().includes(query.q!.toLowerCase()))
    : requests
  const requestsTotal = requestMatches.length
  const requestsPageMax = Math.max(1, Math.ceil(requestsTotal / PAGE_SIZE))
  const requestsPage = Math.min(query.requestsPage, requestsPageMax)
  const pagedRequests = requestMatches.slice((requestsPage - 1) * PAGE_SIZE, requestsPage * PAGE_SIZE)

  return {
    items: items.map(item => ({
      id: item._id.toString(),
      imageUrl: item.imageUrl,
      itemName: item.itemName,
      materialCode: item.materialCode,
      status: item.status,
      weightKg: item.weightKg,
      createdAt: item.createdAt?.toISOString() ?? null
    })),
    requests: pagedRequests,
    itemsTotal,
    requestsTotal,
    itemsPage,
    requestsPage,
    pageSize: PAGE_SIZE
  }
})
