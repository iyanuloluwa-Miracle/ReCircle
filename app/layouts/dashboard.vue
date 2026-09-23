<script setup lang="ts">
import { dashboardPathByRole, type UserRole } from '../../types'
import '~/assets/css/dashboard.css'

const auth = useAuth()
const { user } = auth
const route = useRoute()
const loggingOut = ref(false)
const logoutError = ref('')
const navOpen = ref(false)
const isMobile = ref(false)
const sidebar = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const main = ref<HTMLElement | null>(null)
const roleLabel: Record<UserRole, string> = { user: 'Consumer', recycler: 'Recycler', waste_operator: 'Operator' }
const overviewPath = computed(() => user.value ? dashboardPathByRole[user.value.role] : '/workspace')
const headerCrumb = computed(() => {
  if (route.path.endsWith('/analysis')) return 'Review your item'
  if (route.path.endsWith('/match')) return 'Find a recycler'
  if (route.path.startsWith('/scan')) return 'Scan an item'
  if (route.path.startsWith('/dashboard/analytics')) return 'Analytics'
  return 'Overview'
})
const avatarSrc = computed(() => user.value?.avatarUrl?.startsWith('http') ? user.value.avatarUrl : null)
const navigation = computed(() => [
  { to: overviewPath.value, label: 'Overview', icon: 'overview', active: route.path === overviewPath.value },
  ...(user.value ? [{ to: '/dashboard/analytics', label: 'Analytics', icon: 'chart', active: route.path.startsWith('/dashboard/analytics') }] : []),
  ...(user.value?.role === 'user' ? [{ to: '/scan', label: 'Scan an item', icon: 'scan', active: route.path.startsWith('/scan') }] : [])
])

watch(() => route.fullPath, async () => {
  navOpen.value = false
  await nextTick()
  main.value?.scrollTo({ top: 0 })
})
watch(navOpen, async (open) => {
  if (!import.meta.client) return
  await nextTick()
  if (open) sidebar.value?.querySelector<HTMLButtonElement>('button')?.focus()
  else if (isMobile.value) menuButton.value?.focus()
})
let media: MediaQueryList | undefined
function syncViewport() {
  isMobile.value = media?.matches ?? false
  if (!isMobile.value) navOpen.value = false
}
function onNavKeydown(event: KeyboardEvent) {
  if (!navOpen.value || !isMobile.value) return
  if (event.key === 'Escape') { navOpen.value = false; return }
  if (event.key !== 'Tab') return
  const elements = sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
  const first = elements?.[0]
  const last = elements?.[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => {
  media = window.matchMedia('(max-width: 960px)')
  syncViewport()
  media.addEventListener('change', syncViewport)
})
onUnmounted(() => media?.removeEventListener('change', syncViewport))
async function signOut() {
  loggingOut.value = true
  logoutError.value = ''
  try { await auth.logout(); await navigateTo('/login') }
  catch { logoutError.value = 'Could not sign out. Please try again.' }
  finally { loggingOut.value = false }
}
</script>

<template>
  <div class="workspace-app">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="workspace-backdrop" :class="{ 'is-open': navOpen }" aria-hidden="true" @click="navOpen = false" />
    <aside id="workspace-navigation" ref="sidebar" class="workspace-sidebar" :class="{ 'is-open': navOpen }" :inert="isMobile && !navOpen" aria-label="Workspace" @keydown="onNavKeydown">
      <div class="workspace-sidebar-top">
        <BrandMark />
        <button type="button" class="workspace-nav-close" aria-label="Close navigation" @click="navOpen = false"><DashboardIcon name="close" /></button>
      </div>
      <div class="workspace-brand-caption">Small actions. Lasting impact.</div>
      <p class="eyebrow workspace-label">Workspace</p>
      <nav class="workspace-nav" aria-label="Workspace navigation">
        <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" class="workspace-nav-item" :class="{ 'is-active': item.active }" :aria-current="item.active ? 'page' : undefined">
          <DashboardIcon :name="item.icon" /><span>{{ item.label }}</span><span v-if="item.active" class="workspace-active-dot" aria-hidden="true" />
        </NuxtLink>
      </nav>
      <div class="workspace-sidebar-impact">
        <span class="workspace-impact-icon"><DashboardIcon name="leaf" /></span>
        <p>A little greener,<br><strong>every day.</strong></p>
        <span>Give your recyclables a new beginning.</span>
        <NuxtLink v-if="user?.role === 'user'" to="/scan">Make your next scan <DashboardIcon name="arrow" /></NuxtLink>
        <NuxtLink v-else-if="user" to="/dashboard/analytics">Explore your impact <DashboardIcon name="arrow" /></NuxtLink>
      </div>
      <div class="workspace-sidebar-foot">
        <NuxtLink to="/" class="workspace-home-link"><DashboardIcon name="home" />Back to home</NuxtLink>
        <div v-if="user" class="workspace-user">
          <div class="workspace-user-avatar" aria-hidden="true"><img v-if="avatarSrc" :src="avatarSrc" alt=""><span v-else>{{ user.name.slice(0, 1).toUpperCase() }}</span></div>
          <div class="workspace-user-copy"><strong>{{ user.name }}</strong><span>{{ roleLabel[user.role] }} account</span></div>
        </div>
        <p class="workspace-note"><span class="status-dot" /> Made for a greener Nigeria</p>
      </div>
    </aside>
    <div class="workspace-body" :inert="isMobile && navOpen">
      <header class="workspace-header">
        <div class="workspace-header-start">
          <button ref="menuButton" type="button" class="workspace-nav-toggle" :aria-expanded="navOpen" aria-controls="workspace-navigation" aria-label="Open navigation" @click="navOpen = true">
            <span class="workspace-nav-toggle-bar" /><span class="workspace-nav-toggle-bar" /><span class="workspace-nav-toggle-bar" />
          </button>
          <div class="workspace-crumb"><span class="workspace-crumb-brand">Workspace</span><span class="workspace-crumb-sep" aria-hidden="true">/</span><span>{{ headerCrumb }}</span></div>
        </div>
        <div class="workspace-header-actions">
          <span v-if="user?.isDemo" class="workspace-account-label">Demo account</span>
          <span v-else-if="user" class="workspace-account-label">{{ roleLabel[user.role] }}</span>
          <BaseButton v-if="user" variant="ghost" size="sm" :loading="loggingOut" @click="signOut"><DashboardIcon name="logout" />Sign out</BaseButton>
          <BaseButton v-else to="/login" variant="ghost" size="sm">Sign in</BaseButton>
        </div>
      </header>
      <p v-if="logoutError" class="form-error workspace-logout-error" role="alert">{{ logoutError }}</p>
      <main id="main-content" ref="main" class="workspace-main" tabindex="-1"><slot /></main>
    </div>
    <div v-if="user" :inert="isMobile && navOpen"><AiAssistantDrawer /></div>
  </div>
</template>

