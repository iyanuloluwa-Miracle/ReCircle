import type { AuthResponse, AuthUser, UserRole } from '../../types'

export { nextOnboardingPath, postAuthDestination } from '../../utils/onboarding'

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const signupToken = useState<string | null>('signup-token', () => null)
  const signupEmail = useState<string | null>('signup-email', () => null)

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

  async function startSignup(name: string, email: string, role: UserRole) {
    const result = await $fetch<{ email: string }>('/api/auth/signup/start', {
      method: 'POST', body: { name, email, role }
    })
    signupEmail.value = result.email
    signupToken.value = null
    return result
  }

  async function verifySignupOtp(email: string, code: string) {
    const result = await $fetch<{ email: string; signupToken: string }>('/api/auth/signup/verify-otp', {
      method: 'POST', body: { email, code }
    })
    signupEmail.value = result.email
    signupToken.value = result.signupToken
    return result
  }

  async function resendSignupOtp(email: string) {
    return $fetch<{ email: string }>('/api/auth/signup/resend-otp', {
      method: 'POST', body: { email }
    })
  }

  async function completeSignup(email: string, password: string, token: string) {
    const result = await $fetch<AuthResponse>('/api/auth/signup/complete', {
      method: 'POST', body: { email, password, signupToken: token }
    })
    user.value = result.user
    signupToken.value = null
    signupEmail.value = null
    return result.user
  }

  async function loginWithGoogle(idToken: string, role?: UserRole) {
    const result = await $fetch<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: role ? { idToken, role } : { idToken }
    })
    user.value = result.user
    signupToken.value = null
    signupEmail.value = null
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

  return {
    user,
    signupToken,
    signupEmail,
    refresh,
    login,
    loginWithGoogle,
    startSignup,
    verifySignupOtp,
    resendSignupOtp,
    completeSignup,
    demoLogin,
    logout
  }
}
