import { dashboardPathByRole, type UserRole } from '../../types'

const roleByPath: Record<string, UserRole> = {
  '/dashboard/user': 'user',
  '/dashboard/recycler': 'recycler',
  '/dashboard/operator': 'waste_operator'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const requiredRole = roleByPath[to.path]
  if (!requiredRole) return
  const auth = useAuth()
  let user
  try {
    user = await auth.refresh()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in service is unavailable' })
  }
  if (!user) return navigateTo('/demo')
  if (user.role !== requiredRole) return navigateTo(dashboardPathByRole[user.role])
})
