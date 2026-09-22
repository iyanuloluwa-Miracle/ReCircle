<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Operator workspace — Recykle AI', robots: 'noindex' })

interface OperatorDashboard {
  user: { name: string; email: string; isDemo: boolean }
  metrics: {
    activePickups: number
    kgAwaitingCollection: number
    completedToday: number
    totalPayoutsNgn: number
  }
  statusDistribution: Array<{ status: string; count: number }>
  recentActivity: Array<{
    id: string
    status: string
    businessName: string
    itemName: string | null
    materialCode: string | null
    weightKg: number | null
    expectedPayout: number
    updatedAt: string | null
  }>
  recyclerUtilization: Array<{
    recyclerId: string
    businessName: string
    capacityKgPerDay: number
    currentLoadKg: number
    remainingCapacityKg: number
    utilizationPct: number
    availability: string
    openJobs: number
  }>
  collectionQueue: PickupRequestView[]
}

const { data, pending, error, refresh } = await useAsyncData('operator-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<OperatorDashboard>('/api/dashboard/operator')
})

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Active pickups', value: String(m?.activePickups ?? 0) },
    { label: 'Kg awaiting collection', value: `${formatNumber(m?.kgAwaitingCollection ?? 0)} kg` },
    { label: 'Completed today', value: String(m?.completedToday ?? 0) },
    { label: 'Total payouts', value: formatNaira(m?.totalPayoutsNgn ?? 0) }
  ]
})

const chartLabels = computed(() => (data.value?.statusDistribution ?? []).map(entry => entry.status.replaceAll('_', ' ')))
const chartValues = computed(() => (data.value?.statusDistribution ?? []).map(entry => entry.count))

const utilizationItems = computed(() =>
  (data.value?.recyclerUtilization ?? []).map(entry => ({
    label: entry.businessName,
    value: entry.utilizationPct,
    detail: `${formatNumber(entry.currentLoadKg)} / ${formatNumber(entry.capacityKgPerDay)} kg · ${entry.openJobs} open · ${entry.availability}`
  }))
)
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div>
        <p class="eyebrow">Waste operator workspace</p>
        <h1 class="page-title">Coordinate the circle.</h1>
        <p class="muted workspace-intro">Network-wide metrics, queues, and recycler utilization — all aggregated from MongoDB.</p>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" :lines="8" label="Loading operator dashboard" />
    <BaseCard v-else-if="error">
      <EmptyState title="Could not load operator dashboard" description="Refresh the page or try again shortly.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <template v-else-if="data">
      <DashboardMetrics :metrics="metrics" />

      <div class="dash-grid">
        <DashboardSection title="Status distribution" description="Count of pickup requests by lifecycle status.">
          <StatusDistributionChart :labels="chartLabels" :values="chartValues" />
        </DashboardSection>

        <DashboardSection title="Recent activity" description="Latest request updates across the network.">
          <ul v-if="data.recentActivity.length" class="activity-list">
            <li v-for="entry in data.recentActivity" :key="entry.id">
              <div>
                <strong>{{ entry.itemName || entry.materialCode || 'Waste item' }}</strong>
                <span class="muted">{{ entry.businessName }} · {{ entry.status.replaceAll('_', ' ') }}</span>
              </div>
              <div class="activity-meta">
                <span>{{ entry.weightKg == null ? '—' : `${formatNumber(entry.weightKg)} kg` }}</span>
                <span>{{ formatNaira(entry.expectedPayout) }}</span>
              </div>
            </li>
          </ul>
          <EmptyState v-else title="No recent activity" description="Pickup updates will stream in here." />
        </DashboardSection>

        <DashboardSection title="Recycler utilization" description="Daily load versus capacity for each recycler profile.">
          <BreakdownList :items="utilizationItems" unit="%" />
        </DashboardSection>

        <DashboardSection
          class="dash-span-2"
          title="Collection queue"
          description="Pending, accepted, and picked-up jobs still in motion."
        >
          <div v-if="data.collectionQueue.length" class="request-list">
            <RequestCard
              v-for="request in data.collectionQueue"
              :key="request.id"
              :request="request"
              role="waste_operator"
            />
          </div>
          <EmptyState
            v-else
            title="Queue is clear"
            description="There are no active collection jobs right now."
          />
        </DashboardSection>
      </div>
    </template>
  </div>
</template>
