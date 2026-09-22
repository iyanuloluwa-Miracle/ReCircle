import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { WasteItem } from '../../models/WasteItem'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  const item = await WasteItem.findOne({ _id: id, userId: user.id }).select('imageUrl status location locationSource isDemo createdAt itemName materialCode recyclability confidence disposalMethod preparationInstructions hazardWarning weightKg classificationSource estimatedValueMin estimatedValueMax currency').lean()
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  return {
    id: item._id.toString(), imageUrl: item.imageUrl, status: item.status,
    location: item.location, locationSource: item.locationSource ?? null,
    isDemo: item.isDemo ?? false, createdAt: item.createdAt,
    itemName: item.itemName ?? null, materialCode: item.materialCode ?? null,
    recyclability: item.recyclability ?? null, confidence: item.confidence ?? null,
    disposalMethod: item.disposalMethod ?? null,
    preparationInstructions: item.preparationInstructions ?? [],
    hazardWarning: item.hazardWarning ?? null, weightKg: item.weightKg ?? null,
    classificationSource: item.classificationSource ?? null,
    estimatedValueMin: item.estimatedValueMin ?? null,
    estimatedValueMax: item.estimatedValueMax ?? null,
    currency: item.currency ?? 'NGN'
  }
})
