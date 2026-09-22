<script setup lang="ts">
import { dashboardPathByRole } from '../../types'

definePageMeta({ layout: 'auth' })

const auth = useAuth()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const pending = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  errorMessage.value = ''
  try {
    const user = await auth.login(email.value, password.value)
    await navigateTo(dashboardPathByRole[user.role])
  } catch {
    errorMessage.value = 'Sign in failed. Check your email and password, then try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Sign in — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit
    title="Welcome back to your circle."
    visual-image="/how-it-works/scan.png"
    visual-alt="Phone scanning recyclable materials with ReCircle"
  >
    <AuthSocialBlock />

    <form class="auth-form" @submit.prevent="submit">
      <label for="login-email">Email*</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="you@email.com"
        required
      >

      <div class="auth-label-row">
        <label for="login-password">Password*</label>
        <NuxtLink class="auth-forgot" to="/demo">Forgot Password?</NuxtLink>
      </div>
      <div class="auth-password">
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          placeholder="Min. 8 characters"
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

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" :loading="pending" :disabled="pending">Sign in</BaseButton>
    </form>

    <p class="auth-alternate">
      New here? <NuxtLink to="/register">Create an account</NuxtLink>
      · <NuxtLink to="/demo">Try the demo</NuxtLink>
    </p>
  </AuthSplit>
</template>
