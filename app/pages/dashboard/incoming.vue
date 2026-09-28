<script setup lang="ts">
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Incoming matches — ReCircle', robots: 'noindex' })

interface IncomingDashboard {
  incoming: PickupRequestView[]
  recycler: { businessName: string; availability: 'available' | 'busy' | 'offline' } | null
}

const { data, pending, error, refresh } = await useAsyncData('recycler-incoming', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<IncomingDashboard>('/api/dashboard/recycler')
})

function onUpdated() {
  refresh()
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Recycler workspace</p>
        <h1 class="page-title">Incoming matches.</h1>
        <p class="muted workspace-intro">
          Pending requests assigned to your business. Accept locks wallet funds and reserves daily capacity.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseBadge v-if="data?.recycler" :tone="data.recycler.availability === 'available' ? 'green' : 'warning'">
          {{ data.recycler.availability.toUpperCase() }}
        </BaseBadge>
        <BaseButton to="/dashboard/recycler" variant="secondary" class="dash-cta">Back to overview</BaseButton>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" variant="dashboard" label="Loading incoming matches" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load incoming matches" description="Refresh the page or try again shortly.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <BaseCard v-else-if="data && !data.recycler" class="dash-error-card">
      <EmptyState
        title="Recycler profile missing"
        description="This account has no recycler profile linked yet."
      />
    </BaseCard>
    <DashboardSection
      v-else-if="data"
      title="Matched waste awaiting your decision"
      description="Accept locks funds from your available wallet. Reject returns the request to the consumer."
    >
      <div v-if="data.incoming.length" class="incoming-grid">
        <IncomingRequestCard
          v-for="request in data.incoming"
          :key="request.id"
          :request="request"
          @updated="onUpdated"
        />
      </div>
      <EmptyState
        v-else
        compact
        symbol="◈"
        title="No incoming requests"
        description="When consumers request your business, photo, material, weight, and purchase price appear here."
      />
    </DashboardSection>
  </div>
</template>
