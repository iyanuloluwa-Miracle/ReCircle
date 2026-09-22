import { z } from 'zod'
import type { AuthUser, GeoPoint, UserRole } from '../../types'

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
})

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
})

export const demoSchema = z.strictObject({ role: z.enum(['user', 'recycler', 'waste_operator']) })

export const demoEmailByRole: Record<UserRole, string> = {
  user: 'consumer@recircle-demo.example',
  recycler: 'recycler1@recircle-demo.example',
  waste_operator: 'operator@recircle-demo.example'
}

export function toAuthUser(user: {
  _id: { toString(): string }
  name: string
  email: string
  role: string
  avatarUrl?: string | null
  isDemo?: boolean
  location?: GeoPoint | null
}): AuthUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl ?? null,
    isDemo: user.isDemo ?? false,
    location: user.location ?? null
  }
}
