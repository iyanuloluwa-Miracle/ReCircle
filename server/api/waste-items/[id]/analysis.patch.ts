import { createError, defineEventHandler, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { WasteItem } from '../../../models/WasteItem'
import { LOW_CONFIDENCE_THRESHOLD, materialCodes, recyclabilityValues } from '../../../services/waste-classification'
import { assertSameOrigin } from '../../../utils/origin'
import { requireSessionUser } from '../../../utils/session'
import { readValidatedJson } from '../../../utils/validation'

const bodySchema = z.strictObject({
  materialCode: z.enum(materialCodes).optional(),
  recyclability: z.enum(recyclabilityValues).optional(),
  weightKg: z.number().finite().positive().max(100_000).optional()
}).refine(value => Object.values(value).some(field => field !== undefined), 'At least one field is required')

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  const input = await readValidatedJson(event, bodySchema)
  const item = await WasteItem.findOne({ _id: id, userId: user.id })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  if (item.status !== 'analyzed' && item.status !== 'matched') throw createError({ statusCode: 409, statusMessage: 'This analysis can no longer be edited' })
  if (input.weightKg !== undefined && item.confidence != null && item.confidence < LOW_CONFIDENCE_THRESHOLD
    && item.classificationSource !== 'manual' && input.materialCode === undefined) {
    throw createError({ statusCode: 409, statusMessage: 'Please confirm the material first' })
  }
  if (input.materialCode !== undefined) {
    const changed = input.materialCode !== item.materialCode
    item.materialCode = input.materialCode
    item.recyclability = input.recyclability ?? item.recyclability
    item.classificationSource = 'manual'
    if (changed) {
      item.itemName = input.materialCode === 'UNKNOWN' ? 'Unidentified item' : `${input.materialCode} item`
      item.disposalMethod = 'Check local recycling guidance for the confirmed material.'
      item.preparationInstructions = []
      item.estimatedValueMin = null
      item.estimatedValueMax = null
      item.status = 'analyzed'
    }
  } else if (input.recyclability !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a material when correcting recyclability' })
  }
  if (input.weightKg !== undefined) {
    item.weightKg = input.weightKg
    if (item.status === 'matched') {
      item.estimatedValueMin = null
      item.estimatedValueMax = null
      item.status = 'analyzed'
    }
  }
  await item.save()
  return { id: item.id, status: item.status, materialCode: item.materialCode,
    recyclability: item.recyclability, classificationSource: item.classificationSource, weightKg: item.weightKg }
})
