import { createError } from 'h3'
import { getServerConfig } from '../utils/config'

/** Keep the OpenRouter key and vision requests on the server. */
export function getOpenRouterTransport() {
  const { openrouterApiKey, openrouterModel } = getServerConfig()
  if (!openrouterApiKey || !openrouterModel) {
    throw createError({ statusCode: 503, statusMessage: 'Image identification is not configured' })
  }
  return {
    model: openrouterModel,
    async request(body: Record<string, unknown>): Promise<unknown> {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openrouterApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, model: openrouterModel }),
          signal: AbortSignal.timeout(35000)
        })
        if (!response.ok) throw new Error('Provider request failed')
        return await response.json() as unknown
      } catch {
        throw createError({ statusCode: 502, statusMessage: 'Image identification is unavailable' })
      }
    }
  }
}
