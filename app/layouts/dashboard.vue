<script setup lang="ts">
import { dashboardPathByRole, type UserRole } from '../../types'

const auth = useAuth()
const { user } = auth
const route = useRoute()
const loggingOut = ref(false)
const logoutError = ref('')
const navOpen = ref(false)

const roleLabel: Record<UserRole, string> = {
  user: 'Consumer',
  recycler: 'Recycler',
  waste_operator: 'Operator'
}

const overviewPath = computed(() =>
  user.value ? dashboardPathByRole[user.value.role] : '/workspace'
)

const headerCrumb = computed(() => {
  if (route.path.startsWith('/scan')) return 'Scan'
  if (route.path.startsWith('/dashboard/analytics')) return 'Analytics'
  if (route.path.startsWith('/dashboard/')) return 'Overview'
  if (route.path === '/workspace') return 'Workspace'
  return 'Workspace'
})

const avatarSrc = computed(() => {
  const url = user.value?.avatarUrl
  return url?.startsWith('http') ? url : null
})

watch(() => route.fullPath, () => {
  navOpen.value = false
})

watch(navOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})

async function signOut() {
  loggingOut.value = true
  logoutError.value = ''
  try {
    await auth.logout()
    await navigateTo('/login')
  } catch {
    logoutError.value = 'Could not sign out. Please try again.'
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="workspace-app">
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div
      class="workspace-backdrop"
      :class="{ 'is-open': navOpen }"
      aria-hidden="true"
      @click="navOpen = false"
    />

    <aside class="workspace-sidebar" :class="{ 'is-open': navOpen }" aria-label="Workspace">
      <div class="workspace-sidebar-top">
        <BrandMark />
        <button
          type="button"
          class="workspace-nav-close"
          aria-label="Close navigation"
          @click="navOpen = false"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <p class="eyebrow workspace-label">Your workspace</p>

      <nav class="workspace-nav" aria-label="Workspace navigation">
        <NuxtLink
          :to="overviewPath"
          class="workspace-nav-item"
          :class="{ 'is-active': (route.path === overviewPath) || (route.path.startsWith('/dashboard/') && !route.path.includes('analytics')) }"
        >
          <span class="workspace-nav-icon" aria-hidden="true">◈</span>
          Overview
        </NuxtLink>
        <NuxtLink
          v-if="user"
          to="/dashboard/analytics"
          class="workspace-nav-item"
          :class="{ 'is-active': route.path.startsWith('/dashboard/analytics') }"
        >
          <span class="workspace-nav-icon" aria-hidden="true">▤</span>
          Analytics
        </NuxtLink>
        <NuxtLink
          v-if="user?.role === 'user'"
          to="/scan"
          class="workspace-nav-item"
          :class="{ 'is-active': route.path.startsWith('/scan') }"
        >
          <span class="workspace-nav-icon" aria-hidden="true">▣</span>
          Scan an item
        </NuxtLink>
        <NuxtLink to="/" class="workspace-nav-item">
          <span class="workspace-nav-icon" aria-hidden="true">↗</span>
          Back to home
        </NuxtLink>
      </nav>

      <div class="workspace-sidebar-foot">
        <div v-if="user" class="workspace-user">
          <div class="workspace-user-avatar" aria-hidden="true">
            <img v-if="avatarSrc" :src="avatarSrc" alt="">
            <span v-else>{{ user.name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="workspace-user-copy">
            <strong>{{ user.name }}</strong>
            <span>{{ roleLabel[user.role] }}</span>
          </div>
        </div>
        <p class="workspace-note">
          <span class="status-dot" /> Built for Nigeria.
        </p>
      </div>
    </aside>

    <div class="workspace-body">
      <header class="workspace-header">
        <div class="workspace-header-start">
          <button
            type="button"
            class="workspace-nav-toggle"
            :aria-expanded="navOpen"
            aria-controls="main-content"
            aria-label="Open navigation"
            @click="navOpen = true"
          >
            <span class="workspace-nav-toggle-bar" />
            <span class="workspace-nav-toggle-bar" />
            <span class="workspace-nav-toggle-bar" />
          </button>
          <div class="workspace-crumb">
            <span class="workspace-crumb-brand">ReCircle</span>
            <span class="workspace-crumb-sep" aria-hidden="true">/</span>
            <span>{{ headerCrumb }}</span>
          </div>
        </div>
        <div class="workspace-header-actions">
          <BaseButton v-if="user" variant="ghost" size="sm" :loading="loggingOut" @click="signOut">
            Sign out
          </BaseButton>
          <BaseButton v-else to="/login" variant="ghost" size="sm">Sign in</BaseButton>
        </div>
      </header>

      <p v-if="logoutError" class="form-error workspace-logout-error" role="alert">{{ logoutError }}</p>

      <main id="main-content" class="workspace-main">
        <slot />
      </main>
    </div>

    <AiAssistantDrawer v-if="user" />
  </div>
</template>
