import { dashboardPathByRole, type UserRole } from '../../types'
import { nextOnboardingPath, postAuthDestination } from '../../utils/onboarding'

const roleByPath: Record<string, UserRole> = {
  '/dashboard/user': 'user',
  '/dashboard/recycler': 'recycler',
  '/dashboard/admin': 'admin',
  '/dashboard/operator': 'admin',
  '/dashboard/history': 'user'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const isOnboarding = to.path === '/onboarding/avatar'
    || to.path === '/onboarding/user'
    || to.path === '/onboarding/recycler'

  const requiredRole = roleByPath[to.path]
    ?? (to.path === '/scan' || to.path.startsWith('/scan/') ? 'user' : undefined)
    ?? (to.path === '/dashboard/analytics' || to.path === '/dashboard/settings' ? 'any' as const : undefined)
    ?? (isOnboarding ? 'any' as const : undefined)

  if (!requiredRole && !isOnboarding) return

  const auth = useAuth()
  let user
  try {
    user = await auth.refresh()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in service is unavailable' })
  }
  if (!user) return navigateTo('/login')

  if (isOnboarding) {
    if (user.onboardingCompletedAt) return navigateTo(dashboardPathByRole[user.role])
    if (to.path === '/onboarding/avatar') return
    if (!user.avatarUrl) return navigateTo('/onboarding/avatar')
    const expected = nextOnboardingPath(user)
    if (expected && to.path !== expected && to.path !== '/onboarding/avatar') {
      return navigateTo(expected)
    }
    return
  }

  if (!user.onboardingCompletedAt && !user.isDemo) {
    return navigateTo(postAuthDestination(user))
  }

  if (requiredRole !== 'any' && user.role !== requiredRole) {
    return navigateTo(dashboardPathByRole[user.role])
  }
})
