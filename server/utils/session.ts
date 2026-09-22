import { createError, useSession, type H3Event } from 'h3'
import { z } from 'zod'
import { Types } from 'mongoose'
import type { AuthUser, UserRole } from '../../types'
import { User } from '../models/User'
import { connectDatabase } from './db'
import { getServerConfig } from './config'

const identitySchema = z.object({
  userId: z.string().refine(value => Types.ObjectId.isValid(value))
})

export function getAuthSession(event: H3Event) {
  const { sessionSecret } = getServerConfig()
  if (sessionSecret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Authentication is not configured' })
  }
  return useSession<{ userId?: string }>(event, {
    name: 'recircle-session',
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

export async function getOptionalSessionUser(event: H3Event): Promise<AuthUser | null> {
  const session = await getAuthSession(event)
  const parsed = identitySchema.safeParse(session.data)
  if (!parsed.success) return null
  await connectDatabase()
  const user = await User.findById(parsed.data.userId)
    .select('name email role avatarUrl isDemo location emailVerified onboardingCompletedAt')
    .lean()
  if (!user) return null
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl ?? null,
    isDemo: user.isDemo ?? false,
    location: user.location ?? null,
    emailVerified: user.emailVerified ?? false,
    onboardingCompletedAt: user.onboardingCompletedAt
      ? new Date(user.onboardingCompletedAt).toISOString()
      : null
  }
}

/** Every protected API must authorize against the current MongoDB role. */
export async function requireSessionUser(event: H3Event, allowedRoles?: readonly UserRole[]): Promise<AuthUser> {
  const user = await getOptionalSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  return user
}
