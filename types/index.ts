export type UserRole = 'user' | 'recycler' | 'admin'

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

export const dashboardPathByRole: Record<UserRole, string> = {
  user: '/dashboard/user',
  recycler: '/dashboard/recycler',
  admin: '/dashboard/admin'
}

export const onboardingPathByRole: Record<UserRole, string> = {
  user: '/onboarding/user',
  recycler: '/onboarding/recycler',
  admin: '/dashboard/admin'
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl: string | null
  isDemo: boolean
  location: GeoPoint | null
  emailVerified: boolean
  onboardingCompletedAt: string | null
}

export interface AuthResponse { user: AuthUser }

export type HealthResponse =
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'not_configured' | 'unavailable' }

export interface TimelineStepView {
  id: string
  label: string
  state: 'complete' | 'current' | 'pending'
  at: string | null
}

export interface PickupRequestView {
  id: string
  wasteItemId: string
  recyclerId?: string
  status: string
  businessName: string | null
  itemName: string | null
  materialCode: string | null
  weightKg: number | null
  expectedPayout: number
  pricePerKg: number
  distanceKm: number
  matchScore: number
  imageUrl?: string | null
  pickupArea?: string | null
  requestedPickupTime: string | null
  confirmedPickupTime: string | null
  acceptedAt: string | null
  pickedUpAt: string | null
  completedAt: string | null
  rejectedAt: string | null
  cancelledAt: string | null
  recyclerPhone?: string | null
  createdAt: string | null
  updatedAt: string | null
  timeline: TimelineStepView[]
}

export interface DashboardMetric {
  label: string
  value: string
  detail?: string
}
