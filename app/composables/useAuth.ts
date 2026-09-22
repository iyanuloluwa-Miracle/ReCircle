import type { AuthResponse, AuthUser, UserRole } from '../../types'

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)

  async function refresh(): Promise<AuthUser | null> {
    try {
      const fetcher = import.meta.server ? useRequestFetch() : $fetch
      const result = await fetcher<AuthResponse>('/api/auth/me')
      user.value = result.user
    } catch (error) {
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
      if (status !== 401) throw error
      user.value = null
    }
    return user.value
  }

  async function login(email: string, password: string) {
    const result = await $fetch<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } })
    user.value = result.user
    return result.user
  }

  async function register(name: string, email: string, password: string) {
    const result = await $fetch<AuthResponse>('/api/auth/register', { method: 'POST', body: { name, email, password } })
    user.value = result.user
    return result.user
  }

  async function demoLogin(role: UserRole) {
    const result = await $fetch<AuthResponse>('/api/auth/demo', { method: 'POST', body: { role } })
    user.value = result.user
    return result.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, refresh, login, register, demoLogin, logout }
}
