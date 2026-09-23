import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import type { GeoPoint } from '../../types'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const geocodeBodySchema = z.strictObject({
  query: z.string().trim().min(3).max(200)
})

type NominatimResult = {
  lat?: string
  lon?: string
  display_name?: string
}

export type GeocodeResponse = {
  location: GeoPoint
  label: string
}

export default defineEventHandler(async (event): Promise<GeocodeResponse> => {
  assertSameOrigin(event)
  await requireSessionUser(event)
  const { query } = await readValidatedJson(event, geocodeBodySchema)

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'ng')

  let results: NominatimResult[]
  try {
    results = await $fetch<NominatimResult[]>(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ReCircle/1.0 (pickup-onboarding; https://github.com/iyanuloluwa-Miracle/ReCircle)'
      }
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Could not look up that address' })
  }

  const hit = Array.isArray(results) ? results[0] : undefined
  const lat = hit?.lat != null ? Number(hit.lat) : NaN
  const lon = hit?.lon != null ? Number(hit.lon) : NaN
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw createError({ statusCode: 404, statusMessage: 'No matching address found in Nigeria' })
  }

  const label = typeof hit.display_name === 'string' && hit.display_name.trim()
    ? hit.display_name.trim()
    : query

  return {
    location: { type: 'Point', coordinates: [lon, lat] },
    label
  }
})
