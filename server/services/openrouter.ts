import { createError } from 'h3'
import { getServerConfig } from '../utils/config'

/** Keep the OpenRouter key and model requests on the server. */
export function getOpenRouterTransport(purpose: 'classification' | 'assistant' = 'classification') {
  const { openrouterApiKey, openrouterModel } = getServerConfig()
  const unavailable = purpose === 'assistant' ? 'Assistant is unavailable' : 'Image identification is unavailable'
  const unconfigured = purpose === 'assistant' ? 'Assistant is not configured' : 'Image identification is not configured'
  if (!openrouterApiKey || !openrouterModel) {
    throw createError({ statusCode: 503, statusMessage: unconfigured })
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
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) throw error
        throw createError({ statusCode: 502, statusMessage: unavailable })
      }
    }
  }
}
