import { ByteshipClient } from '@byteship/js'
import { createError } from 'h3'
import { getServerConfig } from '../utils/config'

/** Server-only factory. Upload routes and policies belong to the upload phase. */
export function getByteshipClient() {
  const { byteshipApiKey } = getServerConfig()
  if (!byteshipApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured' })
  }
  return new ByteshipClient({ apiKey: byteshipApiKey })
}
