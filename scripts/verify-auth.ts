import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import mongoose from 'mongoose'
import { User } from '../server/models/User.ts'
import { SignupIntent } from '../server/models/SignupIntent.ts'
import type { AuthResponse, UserRole } from '../types/index.ts'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)
const baseUrl = process.env.AUTH_TEST_URL || 'http://127.0.0.1:3001'
const roles: Array<{ role: UserRole; path: string }> = [
  { role: 'user', path: '/dashboard/user' },
  { role: 'recycler', path: '/dashboard/recycler' },
  { role: 'waste_operator', path: '/dashboard/operator' }
]

async function request(path: string, method = 'GET', body?: object, cookie?: string) {
  return fetch(new URL(path, baseUrl), {
    method, redirect: 'manual',
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
}

function sessionCookie(response: Response) {
  const header = response.headers.get('set-cookie')
  assert.ok(header, 'a session cookie must be set')
  assert.match(header, /HttpOnly/i)
  assert.match(header, /SameSite=Lax/i)
  return header.split(';')[0]!
}

async function expectStatus(path: string, status: number, cookie?: string) {
  const response = await request(path, 'GET', undefined, cookie)
  assert.equal(response.status, status, `${path} should return ${status}`)
  return response
}

try {
  for (const { path } of roles) {
    await expectStatus(`/api${path}`, 401)
    const page = await expectStatus(path, 302)
    assert.equal(new URL(page.headers.get('location')!, baseUrl).pathname, '/login')
  }
  await expectStatus('/api/auth/me', 401)
  assert.equal((await request('/api/auth/demo', 'POST', { role: 'admin' })).status, 400)
  assert.equal((await request('/api/auth/signup/start', 'POST', { name: 'Test User', email: 'bad', role: 'user' })).status, 400)
  assert.equal((await request('/api/auth/login', 'POST', { email: 'bad', password: 'x' })).status, 400)
  assert.equal((await request('/api/auth/google', 'POST', { idToken: 'short' })).status, 400)
  const googleMissing = await request('/api/auth/google', 'POST', {
    idToken: 'a'.repeat(40), role: 'user'
  })
  assert.ok([401, 503].includes(googleMissing.status), 'google auth rejects bad/missing config')
  const crossOrigin = await fetch(new URL('/api/auth/demo', baseUrl), {
    method: 'POST', headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'user' })
  })
  assert.equal(crossOrigin.status, 403)

  for (const current of roles) {
    const login = await request('/api/auth/demo', 'POST', { role: current.role })
    assert.equal(login.status, 200, `${current.role} demo sign-in`)
    const cookie = sessionCookie(login)
    const me = await expectStatus('/api/auth/me', 200, cookie)
    const account = (await me.json() as AuthResponse).user
    assert.equal(account.role, current.role)
    assert.equal(account.isDemo, true)
    assert.equal(account.emailVerified, true)
    assert.equal('passwordHash' in account, false)
    for (const target of roles) {
      await expectStatus(`/api${target.path}`, current.role === target.role ? 200 : 403, cookie)
      const page = await expectStatus(target.path, current.role === target.role ? 200 : 302, cookie)
      if (current.role === target.role) {
        const html = await page.text()
        assert.match(html, /workspace-header-actions/)
        assert.match(html, /DEMO/)
        assert.match(html, /Signed in as/)
      } else {
        assert.equal(new URL(page.headers.get('location')!, baseUrl).pathname, current.path)
      }
    }
    const logout = await request('/api/auth/logout', 'POST', undefined, cookie)
    assert.equal(logout.status, 200)
    assert.ok(logout.headers.get('set-cookie'), 'logout must clear the browser cookie')
    await expectStatus('/api/auth/me', 401)
    console.log(`${current.role}: demo sign-in, role isolation, page redirects, logout verified`)
  }

  const testEmail = `auth-check-${randomUUID()}@example.invalid`
  const testPassword = `DemoTest-${randomUUID()}`
  try {
    const invalidRole = await request('/api/auth/signup/start', 'POST', {
      name: 'Route Test', email: testEmail, role: 'not-a-role'
    })
    assert.equal(invalidRole.status, 400)

    const started = await request('/api/auth/signup/start', 'POST', {
      name: 'Route Test', email: ` ${testEmail.toUpperCase()} `, role: 'waste_operator'
    })
    assert.equal(started.status, 200)
    const startedBody = await started.json() as { email: string }
    assert.equal(startedBody.email, testEmail)

    // When RESEND_API_KEY is unset, the server uses a fixed local OTP.
    const verified = await request('/api/auth/signup/verify-otp', 'POST', {
      email: testEmail, code: '424242'
    })
    assert.equal(verified.status, 200, 'otp verify should succeed with local fixed code when Resend is unset')
    const verifiedBody = await verified.json() as { email: string; signupToken: string }
    assert.ok(verifiedBody.signupToken)

    const completed = await request('/api/auth/signup/complete', 'POST', {
      email: testEmail, password: testPassword, signupToken: verifiedBody.signupToken
    })
    assert.equal(completed.status, 201)
    const registeredAccount = (await completed.json() as AuthResponse).user
    assert.equal(registeredAccount.email, testEmail)
    assert.equal(registeredAccount.role, 'waste_operator')
    assert.equal(registeredAccount.emailVerified, true)
    assert.equal(registeredAccount.isDemo, false)
    assert.equal(registeredAccount.onboardingCompletedAt, null)
    assert.equal('passwordHash' in registeredAccount, false)
    const registrationCookie = sessionCookie(completed)

    const onboardingGate = await expectStatus('/dashboard/operator', 302, registrationCookie)
    assert.equal(new URL(onboardingGate.headers.get('location')!, baseUrl).pathname, '/onboarding/avatar')

    const { AVATAR_PRESETS } = await import('../utils/avatar-presets.ts')
    const avatar = await request('/api/profile/avatar', 'PATCH', { avatarUrl: AVATAR_PRESETS[0] }, registrationCookie)
    assert.equal(avatar.status, 200)

    const stillGated = await expectStatus('/dashboard/operator', 302, registrationCookie)
    assert.equal(new URL(stillGated.headers.get('location')!, baseUrl).pathname, '/onboarding/operator')

    const finished = await request('/api/onboarding/complete', 'POST', undefined, registrationCookie)
    assert.equal(finished.status, 200)
    await expectStatus('/api/dashboard/operator', 200, registrationCookie)

    assert.equal((await request('/api/auth/login', 'POST', { email: testEmail, password: 'wrong-password' })).status, 401)
    const loggedIn = await request('/api/auth/login', 'POST', { email: testEmail.toUpperCase(), password: testPassword })
    assert.equal(loggedIn.status, 200)
    await expectStatus('/api/dashboard/operator', 200, sessionCookie(loggedIn))
    assert.ok(process.env.MONGODB_URI)
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    const stored = await User.findOne({ email: testEmail }).select('+passwordHash')
    assert.ok(stored)
    assert.notEqual(stored.passwordHash, testPassword)
    assert.equal(stored.role, 'waste_operator')
    assert.equal(stored.emailVerified, true)
    console.log('email-first signup, OTP, password, avatar gate, and login verified')
  } finally {
    if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    }
    if (mongoose.connection.readyState === 1) {
      await User.deleteOne({ email: testEmail, isDemo: false })
      await SignupIntent.deleteOne({ email: testEmail })
      await mongoose.disconnect()
    }
  }
  console.log('All authentication HTTP checks passed.')
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown test error'
  console.error(`Authentication HTTP check failed: ${message}`)
  process.exitCode = 1
}
