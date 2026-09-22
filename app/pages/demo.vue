<script setup lang="ts">
import { dashboardPathByRole, type UserRole } from '../../types'

const auth = useAuth()
const busyRole = ref<UserRole | null>(null)
const errorMessage = ref('')
const roles: Array<{ role: UserRole; title: string; description: string }> = [
  { role: 'user', title: 'Demo as Consumer', description: 'See the consumer workspace and account experience.' },
  { role: 'recycler', title: 'Demo as Recycler', description: 'Explore the recycler workspace.' },
  { role: 'waste_operator', title: 'Demo as Operator', description: 'Explore pickup coordination from the operator side.' }
]

async function enterDemo(role: UserRole) {
  errorMessage.value = ''
  busyRole.value = role
  try {
    const user = await auth.demoLogin(role)
    await navigateTo(dashboardPathByRole[user.role])
  } catch {
    errorMessage.value = 'That demo account is unavailable right now. Please try again.'
  } finally {
    busyRole.value = null
  }
}

useSeoMeta({ title: 'Try the demo — ReCircle', robots: 'noindex' })
</script>

<template>
  <section class="auth-page container">
    <div class="auth-intro">
      <p class="eyebrow">Explore ReCircle</p>
      <h1 class="page-title">Choose your place in the circle.</h1>
      <p class="muted">Three seeded accounts let you explore each role. Everything here is demo data.</p>
    </div>
    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <div class="demo-grid">
      <BaseCard v-for="entry in roles" :key="entry.role" class="demo-role-card">
        <BaseBadge tone="lime">DEMO</BaseBadge>
        <h2>{{ entry.title }}</h2>
        <p class="muted">{{ entry.description }}</p>
        <BaseButton :loading="busyRole === entry.role" :disabled="busyRole !== null" @click="enterDemo(entry.role)">{{ entry.title }}</BaseButton>
      </BaseCard>
    </div>
    <p class="auth-alternate">Prefer your own account? <NuxtLink to="/register">Create one</NuxtLink> or <NuxtLink to="/login">sign in</NuxtLink>.</p>
  </section>
</template>
