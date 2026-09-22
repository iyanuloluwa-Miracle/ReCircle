import { createError, useSession, type H3Event } from 'h3'
import { z } from 'zod'
import type { UserRole } from '../../types'
import { getServerConfig } from './config'

const identitySchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['consumer', 'recycler', 'operator'])
})

export function getAuthSession(event: H3Event) {
  const { sessionSecret } = getServerConfig()
  if (sessionSecret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Authentication is not configured' })
  }
  return useSession<{ userId?: string; role?: UserRole }>(event, {
    name: 'recykle-session',
    password: sessionSecret,
    maxAge: 60 * 60 * 24,
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
      path: '/'
    }
  })
}

/** All protected API handlers must enforce authorization on the server. */
export async function requireSessionUser(event: H3Event, allowedRoles?: readonly UserRole[]) {
  const session = await getAuthSession(event)
  const parsed = identitySchema.safeParse(session.data)
  if (!parsed.success) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  if (allowedRoles && !allowedRoles.includes(parsed.data.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  return { id: parsed.data.userId, role: parsed.data.role }
}
