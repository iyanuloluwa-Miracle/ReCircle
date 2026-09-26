<script setup lang="ts">
import { postAuthDestination } from '../../utils/onboarding'

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
    await navigateTo(postAuthDestination(user))
  } catch (error) {
    const statusMessage = error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage)
      : ''
    errorMessage.value = statusMessage.includes('Google')
      ? 'This account uses Google sign-in. Continue with Google instead.'
      : 'Sign in failed. Check your email and password, then try again.'
  } finally {
    pending.value = false
  }
}

async function onGoogleSuccess() {
  const user = auth.user.value
  if (!user) return
  await navigateTo(postAuthDestination(user))
}

useSeoMeta({ title: 'Sign in — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit
    variant="card"
    title="Welcome back"
    subtitle="Sign in with your email and password to continue in your circle."
  >
    <form class="auth-form" @submit.prevent="submit">
      <label for="login-email">Email</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
      >

      <label for="login-password">Password</label>
      <div class="auth-password">
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          placeholder="••••••••"
          required
        >
        <button
          class="auth-password-toggle"
          type="button"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
        </button>
      </div>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" :loading="pending" :disabled="pending">Log in</BaseButton>
    </form>

    <AuthSocialBlock
      mode="login"
      divider-first
      divider-label="OR"
      @success="onGoogleSuccess"
    />

    <p class="auth-alternate">
      New to ReCircle? <NuxtLink to="/register">Sign up</NuxtLink>
    </p>
  </AuthSplit>
</template>
