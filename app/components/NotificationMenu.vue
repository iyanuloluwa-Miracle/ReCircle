<script setup lang="ts">
type Notification = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string | null }
const open = ref(false)
const entries = ref<Notification[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const root = ref<HTMLElement | null>(null)

async function load() {
  loading.value = true
  try {
    const result = await $fetch<{ notifications: Notification[]; unreadCount: number }>('/api/notifications')
    entries.value = result.notifications
    unreadCount.value = result.unreadCount
  } catch {
    // Notifications are supplemental; an unavailable feed must not break the dashboard.
    entries.value = []
  } finally { loading.value = false }
}

function close() {
  open.value = false
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await load()
    if (unreadCount.value) {
      try {
        await $fetch('/api/notifications/read', { method: 'POST' })
        unreadCount.value = 0
        entries.value = entries.value.map(entry => ({ ...entry, readAt: entry.readAt || new Date().toISOString() }))
      } catch {
        // Keep unread state when marking read fails so it can be retried later.
      }
    }
  }
}

function onPointerDown(event: PointerEvent) {
  if (!open.value || !root.value) return
  if (event.target instanceof Node && !root.value.contains(event.target)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') close()
}

onMounted(() => {
  load()
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>
<template>
  <div ref="root" class="notification-menu" :class="{ 'is-open': open }">
    <button type="button" class="notification-toggle" :aria-expanded="open" aria-controls="notifications-panel" aria-label="Notifications" @click="toggle">
      <DashboardIcon name="bell" />
      <b v-if="unreadCount" aria-label="Unread notifications">{{ unreadCount > 9 ? '9+' : unreadCount }}</b>
    </button>
    <div v-if="open" class="notification-backdrop" aria-hidden="true" @click="close" />
    <section v-if="open" id="notifications-panel" class="notification-panel" aria-label="Notifications">
      <header><strong>Notifications</strong><span>{{ unreadCount ? `${unreadCount} new` : 'All caught up' }}</span></header>
      <p v-if="loading" class="notification-empty">Loading updates…</p>
      <p v-else-if="!entries.length" class="notification-empty">Pickup updates will appear here.</p>
      <ul v-else><li v-for="entry in entries" :key="entry.id"><NuxtLink v-if="entry.href" :to="entry.href" @click="close"><strong>{{ entry.title }}</strong><span>{{ entry.body }}</span></NuxtLink><div v-else><strong>{{ entry.title }}</strong><span>{{ entry.body }}</span></div></li></ul>
    </section>
  </div>
</template>
