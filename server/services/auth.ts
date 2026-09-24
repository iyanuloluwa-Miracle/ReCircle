import { createError } from 'h3'
import { z } from 'zod'
import type { AuthUser, GeoPoint, UserRole } from '../../types'
import { SignupIntent } from '../models/SignupIntent'
import { User } from '../models/User'
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  SIGNUP_INTENT_TTL_MS,
  SIGNUP_TOKEN_TTL_MS,
  generateOtpCode,
  generateSignupToken,
  hashOtp,
  hashSignupToken,
  timingSafeEqualHex,
  verifyOtpHash
} from './otp'
import { hashPassword } from './password'
import { getServerConfig } from '../utils/config'
import { verifyGoogleIdToken } from './google-auth'
import { sendSignupOtpEmail } from './resend'

/** Prefer explicit test OTP; otherwise a fixed local code when Resend is unset. */
function issueOtpCode(): string {
  if (process.env.SIGNUP_TEST_OTP && /^\d{6}$/.test(process.env.SIGNUP_TEST_OTP)) {
    return process.env.SIGNUP_TEST_OTP
  }
  const { resendApiKey } = getServerConfig()
  if (!resendApiKey) return '424242'
  return generateOtpCode()
}

export const signupStartSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['user', 'recycler'])
})

export const signupOtpSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().regex(/^\d{6}$/)
})

export const signupResendSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254)
})

export const signupCompleteSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  signupToken: z.string().min(20).max(128)
})

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
})

export const googleAuthSchema = z.strictObject({
  idToken: z.string().min(20).max(4096),
  role: z.enum(['user', 'recycler']).optional()
})

export const demoSchema = z.strictObject({ role: z.enum(['user', 'recycler']) })

/** @deprecated Prefer signup start/complete. Kept for schema tests that may still import. */
export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(['user', 'recycler'])
})

export const demoEmailByRole: Partial<Record<UserRole, string>> = {
  user: 'consumer@recircle-demo.example',
  recycler: 'recycler1@recircle-demo.example'
}

export function toAuthUser(user: {
  _id: { toString(): string }
  name: string
  email: string
  role: string
  avatarUrl?: string | null
  isDemo?: boolean
  location?: GeoPoint | null
  emailVerified?: boolean
  onboardingCompletedAt?: Date | null
}): AuthUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl ?? null,
    isDemo: user.isDemo ?? false,
    location: user.location ?? null,
    emailVerified: user.emailVerified ?? false,
    onboardingCompletedAt: user.onboardingCompletedAt
      ? new Date(user.onboardingCompletedAt).toISOString()
      : null
  }
}

function assertCooldown(lastSentAt: Date) {
  const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt.getTime())
  if (waitMs > 0) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Please wait before requesting another code',
      data: { retryAfterSeconds: Math.ceil(waitMs / 1000) }
    })
  }
}

export async function startSignup(input: z.infer<typeof signupStartSchema>) {
  const existing = await User.findOne({ email: input.email }).select('_id').lean()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const now = new Date()
  const existingIntent = await SignupIntent.findOne({ email: input.email }).select('+otpHash')
  if (existingIntent?.otpLastSentAt) assertCooldown(existingIntent.otpLastSentAt)

  const code = issueOtpCode()
  const otpHash = await hashOtp(code)
  const payload = {
    name: input.name,
    role: input.role,
    otpHash,
    otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
    otpAttempts: 0,
    otpLastSentAt: now,
    emailVerifiedAt: null,
    signupTokenHash: null,
    signupTokenExpiresAt: null,
    expiresAt: new Date(now.getTime() + SIGNUP_INTENT_TTL_MS)
  }

  await SignupIntent.findOneAndUpdate(
    { email: input.email },
    { $set: payload, $setOnInsert: { email: input.email } },
    { upsert: true, new: true }
  )

  await sendSignupOtpEmail(input.email, code)
  return { email: input.email }
}

export async function resendSignupOtp(email: string) {
  const intent = await SignupIntent.findOne({ email }).select('+otpHash')
  if (!intent || intent.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Signup session expired. Start again.' })
  }
  assertCooldown(intent.otpLastSentAt)

  const code = issueOtpCode()
  intent.otpHash = await hashOtp(code)
  intent.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)
  intent.otpAttempts = 0
  intent.otpLastSentAt = new Date()
  intent.emailVerifiedAt = null
  intent.signupTokenHash = null
  intent.signupTokenExpiresAt = null
  await intent.save()

  await sendSignupOtpEmail(email, code)
  return { email }
}

export async function verifySignupOtp(email: string, code: string) {
  const intent = await SignupIntent.findOne({ email }).select('+otpHash +signupTokenHash')
  if (!intent || intent.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Signup session expired. Start again.' })
  }
  if (intent.otpExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Code expired. Request a new one.' })
  }
  if (intent.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw createError({ statusCode: 400, statusMessage: 'Too many attempts. Request a new code.' })
  }

  const ok = await verifyOtpHash(code, intent.otpHash)
  if (!ok) {
    intent.otpAttempts += 1
    await intent.save()
    throw createError({ statusCode: 400, statusMessage: 'Invalid verification code' })
  }

  const signupToken = generateSignupToken()
  intent.emailVerifiedAt = new Date()
  intent.signupTokenHash = hashSignupToken(signupToken)
  intent.signupTokenExpiresAt = new Date(Date.now() + SIGNUP_TOKEN_TTL_MS)
  intent.otpAttempts = 0
  await intent.save()

  return { email, signupToken }
}

export async function completeSignup(email: string, password: string, signupToken: string) {
  const intent = await SignupIntent.findOne({ email }).select('+signupTokenHash')
  if (!intent || intent.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Signup session expired. Start again.' })
  }
  if (!intent.emailVerifiedAt || !intent.signupTokenHash || !intent.signupTokenExpiresAt) {
    throw createError({ statusCode: 400, statusMessage: 'Verify your email before creating a password' })
  }
  if (intent.signupTokenExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Signup token expired. Verify your email again.' })
  }
  if (!timingSafeEqualHex(hashSignupToken(signupToken), intent.signupTokenHash)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signup token' })
  }

  const existing = await User.findOne({ email }).select('_id').lean()
  if (existing) {
    // A browser can retry this request after the account was created but before
    // it received the response. The OTP-backed token proves this is the same
    // signup attempt, so completing it is safe and keeps the flow idempotent.
    await SignupIntent.deleteOne({ email })
    const existingUser = await User.findById(existing._id)
    if (existingUser) return existingUser
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  try {
    // Earlier schema versions persisted `googleId: null`. MongoDB includes an
    // explicit null in a sparse unique index, so remove those legacy values
    // before creating another password-based account.
    await User.updateMany({ googleId: null }, { $unset: { googleId: 1 } })
    const user = await User.create({
      name: intent.name,
      email,
      passwordHash: await hashPassword(password),
      role: intent.role,
      emailVerified: true,
      onboardingCompletedAt: null,
      isDemo: false
    })
    await SignupIntent.deleteOne({ email })
    return user
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      // Another completion request won the unique-index race. Return that user
      // as the successful result of this verified signup attempt.
      const createdUser = await User.findOne({ email })
      if (createdUser) {
        await SignupIntent.deleteOne({ email })
        return createdUser
      }
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
    }
    throw error
  }
}

export async function signInWithGoogle(idToken: string, role?: UserRole) {
  const identity = await verifyGoogleIdToken(idToken)
  let user = await User.findOne({
    $or: [{ googleId: identity.googleId }, { email: identity.email }]
  })

  if (user) {
    if (user.isDemo) {
      throw createError({ statusCode: 403, statusMessage: 'Demo accounts cannot use Google sign-in' })
    }
    if (!user.googleId) {
      user.googleId = identity.googleId
      user.emailVerified = true
      if (!user.avatarUrl && identity.picture) user.avatarUrl = identity.picture
      await user.save()
    } else if (user.googleId !== identity.googleId) {
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered with a different account' })
    }
    return user
  }

  if (!role) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a role before continuing with Google'
    })
  }

  try {
    return await User.create({
      name: identity.name,
      email: identity.email,
      googleId: identity.googleId,
      passwordHash: null,
      role,
      avatarUrl: identity.picture,
      emailVerified: true,
      onboardingCompletedAt: null,
      isDemo: false
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
    }
    throw error
  }
}
