import { createError, defineEventHandler } from 'h3'
import { WasteItem } from '../../models/WasteItem'
import { draftBodySchema, verifyReadyWasteImage } from '../../services/waste-upload'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user'])
  const { filePath, location, locationSource } = await readValidatedJson(event, draftBodySchema)
  if (locationSource === 'demo' && (!user.isDemo || !user.location
    || user.location.coordinates[0] !== location.coordinates[0]
    || user.location.coordinates[1] !== location.coordinates[1])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid demo pickup location' })
  }
  const existing = await WasteItem.findOne({ userId: user.id, storagePath: filePath })
  if (existing) return { id: existing.id, imageUrl: existing.imageUrl, status: existing.status }
  let imageUrl: string
  try {
    imageUrl = await verifyReadyWasteImage(filePath, user.id)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: 'Could not verify the uploaded image; retry shortly' })
  }
  try {
    const draft = await WasteItem.create({
      userId: user.id, imageUrl, storagePath: filePath, location, locationSource,
      status: 'draft', isDemo: user.isDemo
    })
    return { id: draft.id, imageUrl: draft.imageUrl, status: draft.status }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const draft = await WasteItem.findOne({ userId: user.id, storagePath: filePath })
      if (draft) return { id: draft.id, imageUrl: draft.imageUrl, status: draft.status }
    }
    throw createError({ statusCode: 503, statusMessage: 'Could not save your draft; retry shortly' })
  }
})
