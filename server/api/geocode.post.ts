import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import type { GeoPoint } from '../../types'
import { getServerConfig } from '../utils/config'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const geocodeBodySchema = z.strictObject({
  query: z.string().trim().min(3).max(200)
})

type GoogleGeocodeResult = {
  formatted_address?: string
  geometry?: {
    location?: { lat?: number; lng?: number }
  }
}

type GoogleGeocodeResponse = {
  status?: string
  results?: GoogleGeocodeResult[]
  error_message?: string
}

export type GeocodeResponse = {
  location: GeoPoint
  label: string
}

export default defineEventHandler(async (event): Promise<GeocodeResponse> => {
  assertSameOrigin(event)
  await requireSessionUser(event)
  const { query } = await readValidatedJson(event, geocodeBodySchema)
  const { googleMapsApiKey } = getServerConfig()
  if (!googleMapsApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Google Maps is not configured. Add GOOGLE_MAPS_API_KEY to the server environment.'
    })
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('key', googleMapsApiKey)

  let payload: GoogleGeocodeResponse
  try {
    payload = await $fetch<GoogleGeocodeResponse>(url.toString())
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Could not look up that address' })
  }

  if (payload.status === 'ZERO_RESULTS' || !payload.results?.length) {
    throw createError({ statusCode: 404, statusMessage: 'No matching address found in Africa' })
  }
  if (payload.status && payload.status !== 'OK') {
    throw createError({
      statusCode: 502,
      statusMessage: payload.error_message || 'Could not look up that address'
    })
  }

  const hit = payload.results[0]
  const lat = hit?.geometry?.location?.lat
  const lng = hit?.geometry?.location?.lng
  if (typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw createError({ statusCode: 404, statusMessage: 'No matching address found in Africa' })
  }

  const label = typeof hit.formatted_address === 'string' && hit.formatted_address.trim()
    ? hit.formatted_address.trim()
    : query

  return {
    location: { type: 'Point', coordinates: [lng, lat] },
    label
  }
})
