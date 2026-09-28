<script setup lang="ts">
import { createError } from 'h3'
import type { PickupRequestView } from '../../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Pickup details — ReCircle', robots: 'noindex' })

const route = useRoute()
const requestId = computed(() => String(route.params.id || ''))

const { data: request, pending, error, refresh } = await useAsyncData(
  () => `consumer-pickup-${requestId.value}`,
  async () => {
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    const response = await fetcher<{ requests: PickupRequestView[] }>('/api/requests')
    const pickup = response.requests.find(entry => entry.id === requestId.value)
    if (!pickup) throw createError({ statusCode: 404, statusMessage: 'Pickup not found' })
    return pickup
  },
  { watch: [requestId] }
)

let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshTimer = setInterval(() => { void refresh() }, 15_000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="dash-page pickup-detail-page">
    <div class="dash-hero pickup-detail-hero">
      <div>
        <BaseButton to="/dashboard/user" size="sm" variant="ghost">← Back to dashboard</BaseButton>
        <p class="eyebrow">Pickup details</p>
        <h1 class="page-title">Track your pickup.</h1>
        <p class="muted workspace-intro">Follow each step, coordinate with your recycler, and keep the pickup details in one place.</p>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" :lines="7" label="Loading pickup details" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load this pickup" description="It may no longer be active, or your connection may have changed.">
        <BaseButton to="/dashboard/user">Back to dashboard</BaseButton>
        <BaseButton variant="ghost" @click="refresh()">Try again</BaseButton>
      </EmptyState>
    </BaseCard>
    <template v-else-if="request">
      <DashboardSection title="Pickup details" description="Your recycler, reward, timing, and live pickup status.">
        <RequestCard :request="request" role="user" @updated="() => refresh()" />
      </DashboardSection>
    </template>
  </div>
</template>

<style scoped>
.pickup-detail-hero {
  align-items: flex-start;
}
.pickup-detail-hero .button {
  margin-bottom: 1.1rem;
}
</style>
