export type UserRole = 'user' | 'recycler' | 'waste_operator'

export const dashboardPathByRole: Record<UserRole, string> = {
  user: '/dashboard/user',
  recycler: '/dashboard/recycler',
  waste_operator: '/dashboard/operator'
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl: string | null
  isDemo: boolean
}

export interface AuthResponse { user: AuthUser }

export type HealthResponse =
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'not_configured' | 'unavailable' }
