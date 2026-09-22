<script setup lang="ts">
import { dashboardPathByRole } from '../../types'

const auth = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
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
    errorMessage.value = status === 409 ? 'That email already has an account.' : 'We could not create your account. Please check your details and try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Create an account — ReCircle', robots: 'noindex' })
</script>

<template>
  <section class="auth-page container">
    <div class="auth-panel">
      <p class="eyebrow">Join the circle</p>
      <h1 class="page-title">Create your account.</h1>
      <p class="muted">Start as a consumer. Recycler and operator accounts are provisioned separately.</p>
      <form class="auth-form" @submit.prevent="submit">
        <label for="register-name">Name</label>
        <input id="register-name" v-model="name" autocomplete="name" minlength="2" maxlength="120" required>
        <label for="register-email">Email</label>
        <input id="register-email" v-model="email" type="email" autocomplete="email" required>
        <label for="register-password">Password</label>
        <input id="register-password" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>
        <p class="muted auth-hint">Use at least 12 characters.</p>
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        <BaseButton type="submit" :loading="pending" :disabled="pending">Create account</BaseButton>
      </form>
      <p class="auth-alternate">Already have an account? <NuxtLink to="/login">Sign in</NuxtLink>. Exploring? <NuxtLink to="/demo">Try the demo</NuxtLink>.</p>
    </div>
  </section>
</template>
