import { createError, defineEventHandler } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { WasteItem } from '../models/WasteItem'
import { classifyWasteImage } from '../services/waste-classification'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const bodySchema = z.strictObject({ wasteItemId: z.string().refine(value => Types.ObjectId.isValid(value)) })

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'waste_operator'])
  const { wasteItemId } = await readValidatedJson(event, bodySchema)
  const ownerFilter = user.role === 'waste_operator' ? {} : { userId: user.id }
  const filter = { _id: wasteItemId, ...ownerFilter }
  const item = await WasteItem.findOne(filter)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Waste item not found' })
  if (item.status !== 'draft') {
    if (item.classificationSource && item.itemName && item.materialCode) return { id: item.id, status: item.status, cached: true }
    throw createError({ statusCode: 409, statusMessage: 'This item cannot be analyzed again' })
  }

  const lockUntil = new Date(Date.now() + 60_000)
  const locked = await WasteItem.findOneAndUpdate({
    ...filter, status: 'draft',
    $or: [{ analysisLockUntil: null }, { analysisLockUntil: { $lt: new Date() } }]
  }, { $set: { analysisLockUntil: lockUntil } }, { returnDocument: 'after' })
  if (!locked) {
    const latest = await WasteItem.findOne(filter).select('status classificationSource itemName materialCode')
    if (latest?.status !== 'draft' && latest?.classificationSource) return { id: latest.id, status: latest.status, cached: true }
    throw createError({ statusCode: 409, statusMessage: 'Analysis is already running. Retry shortly.' })
  }

  try {
    const classification = await classifyWasteImage(locked.imageUrl)
    const saved = await WasteItem.findOneAndUpdate({ ...filter, status: 'draft', analysisLockUntil: lockUntil }, {
      $set: { ...classification, status: 'analyzed', classificationSource: 'ai', analysisLockUntil: null }
    }, { returnDocument: 'after', runValidators: true })
    if (!saved) throw new Error('Analysis lock expired')
    return { id: saved.id, status: saved.status, cached: false }
  } catch (error) {
    await WasteItem.updateOne({ ...filter, status: 'draft', analysisLockUntil: lockUntil }, { $set: { analysisLockUntil: null } })
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: 'Could not identify this image. Please retry.' })
  }
})
