import { createError } from 'h3'
import { z } from 'zod'
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, hasImageSignature } from '../../utils/waste-image'
import { getByteshipClient } from './byteship'

export { MAX_IMAGE_BYTES } from '../../utils/waste-image'

const longitude = z.number().finite().min(-180).max(180)
const latitude = z.number().finite().min(-90).max(90)

export const draftBodySchema = z.strictObject({
  filePath: z.string().min(1).max(200),
  location: z.strictObject({ type: z.literal('Point'), coordinates: z.tuple([longitude, latitude]) }),
  locationSource: z.enum(['device', 'demo', 'manual'])
})

export function userImageFolder(userId: string) {
  return `waste-images/${userId}`
}

export function isOwnedImagePath(filePath: string, userId: string) {
  const folder = userImageFolder(userId)
  return new RegExp(`^${folder}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(filePath)
}

/** Confirm provider metadata and file bytes before accepting a public URL. */
export async function verifyReadyWasteImage(filePath: string, userId: string) {
  if (!isOwnedImagePath(filePath, userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image path' })
  }
  const { file } = await getByteshipClient().getFile(filePath)
  if (file.path !== filePath || file.status !== 'ready' || file.visibility !== 'public'
    || file.byteSize < 1 || file.byteSize > MAX_IMAGE_BYTES
    || !IMAGE_MIME_TYPES.includes(file.contentType as typeof IMAGE_MIME_TYPES[number])
    || !file.url) {
    throw createError({ statusCode: 415, statusMessage: 'Uploaded file is not a supported image' })
  }
  let url: URL
  try {
    url = new URL(file.url)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Image URL is unavailable' })
  }
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.byteship.cloud' || !decodeURIComponent(url.pathname).endsWith(`/${filePath}`)) {
    throw createError({ statusCode: 502, statusMessage: 'Image URL is unavailable' })
  }
  const response = await fetch(url, { headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Image delivery is not ready; retry shortly' })
  const reader = response.body?.getReader()
  if (!reader) throw createError({ statusCode: 502, statusMessage: 'Image delivery is not ready; retry shortly' })
  const header = new Uint8Array(16)
  let length = 0
  while (length < header.length) {
    const part = await reader.read()
    if (part.done || !part.value) break
    const take = Math.min(part.value.length, header.length - length)
    header.set(part.value.subarray(0, take), length)
    length += take
  }
  await reader.cancel()
  if (!hasImageSignature(header.subarray(0, length), file.contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'Uploaded file is not a supported image' })
  }
  return file.url
}
