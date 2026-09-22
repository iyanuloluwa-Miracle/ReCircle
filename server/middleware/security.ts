import { defineEventHandler, setResponseHeaders } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY'
  })
  if (event.path.startsWith('/api/')) {
    setResponseHeaders(event, { 'Cache-Control': 'no-store' })
  }
})
