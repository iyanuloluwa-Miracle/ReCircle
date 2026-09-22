import { createError, defineEventHandler } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { WasteItem } from '../models/WasteItem'
import { matchRecyclersForWaste } from '../services/recycler-matching'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const bodySchema = z.strictObject({
  wasteItemId: z.string().refine(value => Types.ObjectId.isValid(value)),
  weightKg: z.number().finite().positive().max(100_000)
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const { wasteItemId, weightKg } = await readValidatedJson(event, bodySchema)

  const item = await WasteItem.findOne({ _id: wasteItemId, userId: user.id })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  if (item.status !== 'analyzed' && item.status !== 'matched') {
    throw createError({ statusCode: 409, statusMessage: 'This item is not ready for recycler matching' })
  }
  if (!item.materialCode || !item.itemName) {
    throw createError({ statusCode: 409, statusMessage: 'Classify this item before matching recyclers' })
  }
  if (!item.location?.coordinates) {
    throw createError({ statusCode: 409, statusMessage: 'Pickup location is required for matching' })
  }

  const result = await matchRecyclersForWaste({
    location: item.location,
    materialCode: item.materialCode,
    weightKg
  })

  item.weightKg = weightKg
  if (result.matches.length > 0) {
    item.estimatedValueMin = result.estimatedValueMin
    item.estimatedValueMax = result.estimatedValueMax
    item.currency = 'NGN'
    item.status = 'matched'
  } else {
    item.estimatedValueMin = null
    item.estimatedValueMax = null
    if (item.status === 'matched') item.status = 'analyzed'
  }
  await item.save()

  return {
    id: item.id,
    status: item.status,
    weightKg: item.weightKg,
    materialCode: item.materialCode,
    currency: item.currency,
    estimatedValueMin: item.estimatedValueMin,
    estimatedValueMax: item.estimatedValueMax,
    matches: result.matches,
    recommended: result.recommended
  }
})
