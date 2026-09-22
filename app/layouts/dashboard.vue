<script setup lang="ts">
import { dashboardPathByRole } from '../../types'

const auth = useAuth()
const { user } = auth
const loggingOut = ref(false)
const logoutError = ref('')

async function signOut() {
  loggingOut.value = true
  logoutError.value = ''
  try {
    await auth.logout()
    await navigateTo('/demo')
  } catch {
    logoutError.value = 'Could not sign out. Please try again.'
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-shell">
      <a class="skip-link" href="#main-content">Skip to content</a>
      <aside class="workspace-sidebar">
        <BrandMark />
        <p class="eyebrow workspace-label">Your workspace</p>
        <nav aria-label="Workspace navigation">
          <NuxtLink v-if="user" :to="dashboardPathByRole[user.role]" class="workspace-nav-item"><span aria-hidden="true">◈</span> Overview</NuxtLink>
          <NuxtLink v-else to="/workspace" class="workspace-nav-item"><span aria-hidden="true">◈</span> Preview</NuxtLink>
          <NuxtLink v-if="user" to="/dashboard/analytics" class="workspace-nav-item"><span aria-hidden="true">▤</span> Analytics</NuxtLink>
          <NuxtLink v-if="user?.role === 'user'" to="/scan" class="workspace-nav-item"><span aria-hidden="true">▣</span> Scan an item</NuxtLink>
          <NuxtLink to="/demo" class="workspace-nav-item"><span aria-hidden="true">↗</span> Switch demo role</NuxtLink>
          <NuxtLink to="/" class="workspace-nav-item"><span aria-hidden="true">↗</span> Back to home</NuxtLink>
        </nav>
        <div class="workspace-note"><span class="status-dot" /> Built for a better circle.<br><span class="muted">Starting with Lagos.</span></div>
      </aside>
      <div class="workspace-body">
        <header class="workspace-header">
          <span>Recykle AI / Workspace</span>
          <div class="workspace-header-actions">
            <BaseBadge v-if="user?.isDemo" tone="lime">DEMO</BaseBadge>
            <BaseButton v-if="user" variant="ghost" size="sm" :loading="loggingOut" @click="signOut">Sign out</BaseButton>
            <BaseBadge v-else tone="green">Public preview</BaseBadge>
          </div>
        </header>
        <p v-if="logoutError" class="form-error" role="alert">{{ logoutError }}</p>
        <main id="main-content" class="workspace-main"><slot /></main>
      </div>
    </div>
    <AiAssistantDrawer v-if="user" />
  </div>
</template>
