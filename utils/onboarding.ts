import { dashboardPathByRole, onboardingPathByRole, type AuthUser } from '../types'

export function nextOnboardingPath(user: AuthUser): string | null {
  if (user.isDemo || user.onboardingCompletedAt) return null
  if (!user.avatarUrl) return '/onboarding/avatar'
  return onboardingPathByRole[user.role]
}

export function postAuthDestination(user: AuthUser): string {
  return nextOnboardingPath(user) ?? dashboardPathByRole[user.role]
}
