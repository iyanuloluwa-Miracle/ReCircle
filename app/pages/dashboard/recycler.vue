<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Recycler workspace — ReCircle', robots: 'noindex' })

interface RecyclerDashboard {
  user: { name: string; email: string; isDemo: boolean }
  recycler: { businessName: string; availability: 'available' | 'busy' | 'offline'; businessHours: string; operatingHours: Array<{ day: number; open: string; close: string; enabled: boolean }>; contactPhone: string | null; serviceRadiusKm: number; capacityKgPerDay: number; acceptedMaterials: string[]; pricingRules: Array<{ material: string; pricePerKg: number; currency: 'NGN' }> } | null
  metrics: {
    availableSupplyKg: number
    jobsToday: number
    potentialPurchaseValueNgn: number
    completedCollections: number
  }
  incoming: PickupRequestView[]
  acceptedPickups: PickupRequestView[]
  materialBreakdown: Array<{ materialCode: string; weightKg: number; count: number; valueNgn: number }>
  capacity: {
    capacityKgPerDay: number
    currentLoadKg: number
    remainingCapacityKg: number
    utilizationPct: number
  } | null
}

const { data, pending, error, refresh } = await useAsyncData('recycler-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<RecyclerDashboard>('/api/dashboard/recycler')
})

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Available supply', value: `${formatNumber(m?.availableSupplyKg ?? 0)} kg` },
    { label: 'Jobs today', value: String(m?.jobsToday ?? 0) },
    { label: 'Potential purchase value', value: formatNaira(m?.potentialPurchaseValueNgn ?? 0) },
    { label: 'Completed collections', value: String(m?.completedCollections ?? 0) }
  ]
})

const materialItems = computed(() =>
  (data.value?.materialBreakdown ?? []).map(entry => ({
    label: entry.materialCode,
    value: entry.weightKg,
    detail: `${formatNumber(entry.weightKg)} kg · ${entry.count} jobs · ${formatNaira(entry.valueNgn)}`
  }))
)

function onUpdated() {
  refresh()
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Recycler workspace</p>
        <h1 class="page-title">{{ data?.recycler?.businessName || 'Your recycling desk' }}</h1>
        <p class="muted workspace-intro">
          Incoming matched waste, capacity, and purchase value from live records.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseBadge v-if="data?.recycler" :tone="data.recycler.availability === 'available' ? 'green' : 'warning'">
          {{ data.recycler.availability.toUpperCase() }}
        </BaseBadge>
        <BaseButton to="/dashboard/analytics" variant="secondary" class="dash-cta">View analytics</BaseButton>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" variant="dashboard" label="Loading recycler dashboard" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load recycler dashboard" description="Refresh the page or try again shortly.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <BaseCard v-else-if="data && !data.recycler" class="dash-error-card">
      <EmptyState
        title="Recycler profile missing"
        description="This account has no recycler profile linked yet, so supply metrics cannot be computed."
      />
    </BaseCard>
    <template v-else-if="data">
      <DashboardMetrics :metrics="metrics" />

      <div class="dash-grid">
        <DashboardSection v-if="data.recycler" title="Availability & pricing" description="These settings control whether new consumer matches can reach you."><RecyclerAvailabilityPanel :profile="data.recycler" @saved="refresh" /></DashboardSection>
        <DashboardSection
          class="dash-span-2"
          title="Incoming matched waste"
          description="Pending requests assigned to your business. Accept reserves daily capacity."
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

        <DashboardSection title="Accepted pickups" description="Jobs you have accepted or already collected.">
          <div v-if="data.acceptedPickups.length" class="request-list">
            <RequestCard
              v-for="request in data.acceptedPickups"
              :key="request.id"
              :request="request"
              role="recycler"
              @updated="onUpdated"
            />
          </div>
          <EmptyState
            v-else
            compact
            symbol="◈"
            title="No accepted pickups"
            description="Accepted and in-transit jobs will list here with timeline controls."
          />
        </DashboardSection>

        <DashboardSection title="Material breakdown" description="Weight and value across accepted-or-later jobs.">
          <BreakdownList :items="materialItems" unit="kg" />
        </DashboardSection>

        <DashboardSection title="Current capacity" description="Daily load reserved from accepted pickups.">
          <CapacityMeter
            v-if="data.capacity"
            :capacity-kg-per-day="data.capacity.capacityKgPerDay"
            :current-load-kg="data.capacity.currentLoadKg"
            :remaining-capacity-kg="data.capacity.remainingCapacityKg"
            :utilization-pct="data.capacity.utilizationPct"
          />
          <EmptyState
            v-else
            compact
            title="Capacity unavailable"
            description="Recycler capacity fields are missing."
          />
        </DashboardSection>
      </div>
    </template>
  </div>
</template>
