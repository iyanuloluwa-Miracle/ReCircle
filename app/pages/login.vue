<script setup lang="ts">
import { dashboardPathByRole } from '../../types'

const auth = useAuth()
const email = ref('')
const password = ref('')
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
  <section class="auth-page container">
    <div class="auth-panel">
      <p class="eyebrow">Welcome back</p>
      <h1 class="page-title">Sign in to your circle.</h1>
      <p class="muted">Access your ReCircle workspace.</p>
      <form class="auth-form" @submit.prevent="submit">
        <label for="login-email">Email</label>
        <input id="login-email" v-model="email" type="email" autocomplete="email" required>
        <label for="login-password">Password</label>
        <input id="login-password" v-model="password" type="password" autocomplete="current-password" required>
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        <BaseButton type="submit" :loading="pending" :disabled="pending">Sign in</BaseButton>
      </form>
      <p class="auth-alternate">New here? <NuxtLink to="/register">Create an account</NuxtLink>. Exploring? <NuxtLink to="/demo">Try the demo</NuxtLink>.</p>
    </div>
  </section>
</template>
