import { dashboardPathByRole, type UserRole } from '../../types'

const roleByPath: Record<string, UserRole> = {
  '/dashboard/user': 'user',
  '/dashboard/recycler': 'recycler',
  '/dashboard/operator': 'waste_operator'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const requiredRole = roleByPath[to.path]
    ?? (to.path === '/scan' || to.path.startsWith('/scan/') ? 'user' : undefined)
    ?? (to.path === '/dashboard/analytics' ? 'any' as const : undefined)
  if (!requiredRole) return
  const auth = useAuth()
  let user
  try {
    user = await auth.refresh()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in service is unavailable' })
  }
  if (!user) return navigateTo('/demo')
  if (requiredRole !== 'any' && user.role !== requiredRole) return navigateTo(dashboardPathByRole[user.role])
})
