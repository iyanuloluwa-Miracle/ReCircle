export type UserRole = 'user' | 'recycler' | 'waste_operator'

export interface SessionUser {
  id: string
  role: UserRole
}

export type HealthResponse =
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'not_configured' | 'unavailable' }
