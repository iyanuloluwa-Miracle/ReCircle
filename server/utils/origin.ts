import { createError, getHeader, getRequestURL, type H3Event } from 'h3'

/** Reject browser requests initiated from another origin. */
export function assertSameOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request denied' })
  }
  if (getHeader(event, 'sec-fetch-site') === 'cross-site') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request denied' })
  }
}
