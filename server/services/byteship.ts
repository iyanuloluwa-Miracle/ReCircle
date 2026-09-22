import { ByteshipClient } from '@byteship/js'
import { createError } from 'h3'
import { getServerConfig } from '../utils/config'

/** Project API key stays on the server; browser uploads use scoped tokens. */
export function getByteshipClient() {
  const { byteshipApiKey } = getServerConfig()
  if (!byteshipApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured' })
  }
  return new ByteshipClient({ apiKey: byteshipApiKey })
}
