import { dashboardPathByRole, onboardingPathByRole, type AuthUser, type UserRole } from '../types'

export function nextOnboardingPath(user: AuthUser): string | null {
  if (user.isDemo || user.onboardingCompletedAt) return null
  if (!user.avatarUrl) return '/onboarding/avatar'
  return onboardingPathByRole[user.role]
}

export function postAuthDestination(user: AuthUser): string {
  return nextOnboardingPath(user) ?? dashboardPathByRole[user.role]
}

/** Short labels for the onboarding progress stepper. */
export function onboardingStepsForRole(role: UserRole): string[] {
  if (role === 'user') return ['Avatar', 'Pickup', 'Guide']
  if (role === 'recycler') return ['Avatar', 'Business', 'Location', 'Materials', 'Prices', 'Capacity']
  return ['Avatar', 'Setup']
}
