import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler } from 'h3'
import { getByteshipClient } from '../services/byteship'
import { MAX_IMAGE_BYTES, userAvatarFolder } from '../services/avatar-upload'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'recycler', 'admin'])
  const folder = userAvatarFolder(user.id)
  try {
    const { uploadToken } = await getByteshipClient().createUploadToken({
      folder, visibility: 'public', maxUploadBytes: MAX_IMAGE_BYTES, expiresInSeconds: 15 * 60
    })
    return { token: uploadToken.token, expiresAt: uploadToken.expiresAt, folder, uploadId: randomUUID(), maxBytes: MAX_IMAGE_BYTES }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: 'Image upload is temporarily unavailable' })
  }
})
