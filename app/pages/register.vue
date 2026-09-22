<script setup lang="ts">
import { dashboardPathByRole } from '../../types'

definePageMeta({ layout: 'auth' })

const auth = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const pending = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  errorMessage.value = ''
  try {
    const user = await auth.register(name.value, email.value, password.value)
    await navigateTo(dashboardPathByRole[user.role])
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 409
      ? 'That email already has an account.'
      : 'We could not create your account. Please check your details and try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Create an account — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit
    title="Create your account."
    visual-image="/how-it-works/value.png"
    visual-alt="Recyclable materials sorted and ready for pickup"
  >
    <AuthSocialBlock />

    <form class="auth-form" @submit.prevent="submit">
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

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" :loading="pending" :disabled="pending">Create account</BaseButton>
    </form>

    <p class="auth-alternate">
      Already have an account? <NuxtLink to="/login">Sign in</NuxtLink>
      · <NuxtLink to="/demo">Try the demo</NuxtLink>
    </p>
  </AuthSplit>
</template>
