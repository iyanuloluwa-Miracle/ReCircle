<script setup lang="ts">
import type { UserRole } from '../../types'
import { postAuthDestination } from '../../utils/onboarding'

definePageMeta({ layout: 'auth' })

const auth = useAuth()
const step = ref<'role' | 'identity' | 'otp' | 'password'>('role')
const name = ref('')
const email = ref('')
const role = ref<UserRole>('user')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const resendSeconds = ref(0)
let resendTimer: ReturnType<typeof setInterval> | null = null

const roles: Array<{ value: UserRole; label: string; hint: string; image: string; imageAlt: string }> = [
  {
    value: 'user',
    label: 'Consumer',
    hint: 'Scan waste and request pickup',
    image: '/roles/consumers.png',
    imageAlt: 'Person scanning a recyclable bottle with a smartphone'
  },
  {
    value: 'recycler',
    label: 'Recycler',
    hint: 'Accept collections and set prices',
    image: '/roles/recyclers.png',
    imageAlt: 'Recycling facility with sorted material bales'
  },
  {
    value: 'waste_operator',
    label: 'Waste operator',
    hint: 'Monitor the network and optimize routes',
    image: '/roles/operators.png',
    imageAlt: 'Operations desk with logistics and network monitors'
  }
]

const titles: Record<typeof step.value, string> = {
  role: 'How will you use ReCircle?',
  identity: 'Create your account.',
  otp: 'Check your email.',
  password: 'Set your password.'
}

function startResendCooldown(seconds = 60) {
  resendSeconds.value = seconds
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendSeconds.value -= 1
    if (resendSeconds.value <= 0 && resendTimer) {
      clearInterval(resendTimer)
      resendTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (resendTimer) clearInterval(resendTimer)
})

function continueFromRole() {
  errorMessage.value = ''
  step.value = 'identity'
}

async function onGoogleSuccess() {
  const user = auth.user.value
  if (!user) return
  await navigateTo(postAuthDestination(user))
}

async function submitDetails() {
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.startSignup(name.value, email.value, role.value)
    code.value = ''
    step.value = 'otp'
    startResendCooldown()
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 409
      ? 'That email already has an account.'
      : status === 429
        ? 'Please wait a moment before requesting another code.'
        : 'We could not start signup. Check your details and try again.'
  } finally {
    pending.value = false
  }
}

async function submitOtp(nextCode?: string) {
  const otp = String(nextCode ?? code.value).replace(/\D/g, '').slice(0, 6)
  if (otp.length !== 6 || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.verifySignupOtp(email.value.trim().toLowerCase(), otp)
    step.value = 'password'
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 400
      ? 'That code is invalid or expired.'
      : 'We could not verify that code. Try again.'
    code.value = ''
  } finally {
    pending.value = false
  }
}

async function resend() {
  if (resendSeconds.value > 0 || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.resendSignupOtp(email.value.trim().toLowerCase())
    startResendCooldown()
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 429
      ? 'Please wait before requesting another code.'
      : 'Could not resend the code. Start again if this keeps failing.'
  } finally {
    pending.value = false
  }
}

async function submitPassword() {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  const token = auth.signupToken.value
  if (!token) {
    errorMessage.value = 'Your verification session expired. Start again.'
    step.value = 'identity'
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const user = await auth.completeSignup(email.value.trim().toLowerCase(), password.value, token)
    await navigateTo(postAuthDestination(user))
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 409
      ? 'That email already has an account.'
      : 'We could not create your account. Try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Create an account — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit :title="titles[step]">
    <form v-if="step === 'role'" class="auth-form" @submit.prevent="continueFromRole">
      <p class="muted auth-hint">Pick one. You can finish setup after you sign in.</p>
      <div class="role-picker" role="radiogroup" aria-label="Account role">
        <label
          v-for="option in roles"
          :key="option.value"
          class="role-picker-option"
          :class="{ 'is-selected': role === option.value }"
        >
          <input v-model="role" type="radio" name="role" :value="option.value" required>
          <span class="role-picker-media" aria-hidden="true">
            <img :src="option.image" :alt="option.imageAlt" width="96" height="72" loading="lazy" decoding="async">
          </span>
          <span class="role-picker-copy">
            <span class="role-picker-title">{{ option.label }}</span>
            <span class="role-picker-hint">{{ option.hint }}</span>
          </span>
        </label>
      </div>
      <BaseButton type="submit">Continue</BaseButton>
    </form>

    <template v-else-if="step === 'identity'">
      <AuthSocialBlock mode="signup" :role="role" @success="onGoogleSuccess" />

      <form class="auth-form" @submit.prevent="submitDetails">
        <label for="register-name">Name*</label>
        <input
          id="register-name"
          v-model="name"
          autocomplete="name"
          placeholder="Your name"
          minlength="2"
          maxlength="120"
          required
        >

        <label for="register-email">Email*</label>
        <input
          id="register-email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@email.com"
          required
        >

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        <BaseButton type="submit" :loading="pending" :disabled="pending">Send verification code</BaseButton>
        <BaseButton variant="ghost" type="button" :disabled="pending" @click="step = 'role'">Back</BaseButton>
      </form>
    </template>

    <form v-else-if="step === 'otp'" class="auth-form auth-form--otp" @submit.prevent="submitOtp">
      <p class="muted auth-hint auth-hint--center">
        Enter the 6-digit code sent to <strong>{{ email.trim().toLowerCase() }}</strong>.
      </p>
      <span class="auth-otp-label" id="register-otp-label">Verification code*</span>
      <AuthOtpInput
        id="register-otp"
        v-model="code"
        :disabled="pending"
        aria-labelledby="register-otp-label"
        @complete="value => submitOtp(value)"
      />
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" :loading="pending" :disabled="pending || code.length !== 6">Verify email</BaseButton>
      <button
        class="button button--ghost auth-resend"
        type="button"
        :disabled="pending || resendSeconds > 0"
        @click="resend"
      >
        {{ resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code' }}
      </button>
    </form>

    <form v-else class="auth-form" @submit.prevent="submitPassword">
      <label for="register-password">Password*</label>
      <div class="auth-password">
        <input
          id="register-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="Min. 12 characters"
          minlength="12"
          maxlength="128"
          required
        >
        <button
          class="auth-password-toggle"
          type="button"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <svg v-if="!showPassword" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.7" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M3 3l18 18M10.5 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-4.2 4.8M6.2 6.7A18 18 0 0 0 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <p class="muted auth-hint">Use at least 12 characters.</p>

      <label for="register-password-confirm">Confirm password*</label>
      <input
        id="register-password-confirm"
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
        placeholder="Repeat password"
        minlength="12"
        maxlength="128"
        required
      >

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" :loading="pending" :disabled="pending">Create account</BaseButton>
    </form>

    <p class="auth-alternate">
      Already have an account? <NuxtLink to="/login">Sign in</NuxtLink>
    </p>
  </AuthSplit>
</template>
