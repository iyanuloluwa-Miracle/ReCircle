export type UserRole = 'user' | 'recycler' | 'waste_operator'

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

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
  location: GeoPoint | null
}

export interface AuthResponse { user: AuthUser }

export type HealthResponse =
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'not_configured' | 'unavailable' }
