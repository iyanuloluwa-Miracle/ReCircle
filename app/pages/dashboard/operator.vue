<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Operator workspace — ReCircle', robots: 'noindex' })

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

interface OptimizeResponse {
  zoneId: string
  explanation: string
  disclaimer: string
  zones: Array<{ id: string; name: string }>
  pickupCount: number
  batches: Array<{
    batchNumber: number
    pickupCount: number
    totalWeightKg: number
    estimatedRecyclerValueNgn: number
    suggestedSequenceLabels: string[]
    suggestedOrder: Array<{
      order: number
      areaLabel: string
      latitude: number
      longitude: number
      weightKg: number
      expectedPayout: number
      materialCode: string | null
      status: string
    }>
    naiveDistanceKm: number
    suggestedDistanceKm: number
    distanceSavedKm: number
  }>
}

const selectedZone = ref('all_lagos')
const optimizing = ref(false)
const optimizeError = ref('')
const optimizeResult = ref<OptimizeResponse | null>(null)

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

const zoneOptions = computed(() => optimizeResult.value?.zones ?? [
  { id: 'all_lagos', name: 'All Lagos' },
  { id: 'yaba', name: 'Yaba' },
  { id: 'sabo', name: 'Sabo' },
  { id: 'akoka', name: 'Akoka' },
  { id: 'bariga', name: 'Bariga' },
  { id: 'gbagada', name: 'Gbagada' },
  { id: 'surulere', name: 'Surulere' },
  { id: 'ikeja', name: 'Ikeja' },
  { id: 'lekki', name: 'Lekki' }
])

async function optimizePickups() {
  optimizing.value = true
  optimizeError.value = ''
  try {
    optimizeResult.value = await $fetch<OptimizeResponse>('/api/optimize-pickups', {
      query: { zoneId: selectedZone.value }
    })
  } catch {
    optimizeError.value = 'Could not build collection batches. Please try again.'
  } finally {
    optimizing.value = false
  }
}
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

      <DashboardSection
        class="dash-span-2"
        title="Smart Collection Batch"
        description="ReCircle groups nearby pickups to reduce unnecessary collection travel."
      >
        <div class="optimize-controls">
          <label for="optimize-zone">
            Zone
            <select id="optimize-zone" v-model="selectedZone">
              <option v-for="zone in zoneOptions" :key="zone.id" :value="zone.id">{{ zone.name }}</option>
            </select>
          </label>
          <BaseButton :loading="optimizing" @click="optimizePickups">Optimize pickups</BaseButton>
        </div>
        <p class="muted optimize-disclaimer">Suggested collection sequence uses straight-line nearest-neighbour heuristics — not actual road routing.</p>
        <p v-if="optimizeError" class="form-error" role="alert">{{ optimizeError }}</p>

        <LoadingSkeleton v-if="optimizing" :lines="4" label="Building collection batches" />
        <template v-else-if="optimizeResult">
          <p class="muted" style="margin-bottom: 14px;">
            {{ optimizeResult.pickupCount }} pending/accepted pickups in this zone · {{ optimizeResult.batches.length }} batch{{ optimizeResult.batches.length === 1 ? '' : 'es' }}
          </p>
          <div v-if="optimizeResult.batches.length" class="batch-list">
            <CollectionBatchCard
              v-for="batch in optimizeResult.batches"
              :key="batch.batchNumber"
              :batch="batch"
            />
          </div>
          <EmptyState
            v-else
            title="No batches for this zone"
            description="There are no pending or accepted pickups close enough to group right now."
          />
        </template>
        <EmptyState
          v-else
          title="Ready to optimize"
          description="Choose a Lagos zone and run Optimize pickups to see suggested collection sequences."
        />
      </DashboardSection>

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
