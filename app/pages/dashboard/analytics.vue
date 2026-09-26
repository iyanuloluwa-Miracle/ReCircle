<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Analytics — ReCircle', robots: 'noindex' })

interface ChartSeries {
  label: string
  value: number
  detail?: string
}

interface AnalyticsResponse {
  role: 'user' | 'recycler' | 'admin'
  summary: Record<string, number | string>
  charts: Record<string, ChartSeries[]>
}

const { data, pending, error, refresh } = await useAsyncData('role-analytics', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<AnalyticsResponse>('/api/analytics')
})

const roleTitle = computed(() => {
  if (data.value?.role === 'recycler') return 'Recycler analytics'
  if (data.value?.role === 'admin') return 'Network analytics'
  return 'Your recycling analytics'
})

const summaryCards = computed(() => {
  const summary = data.value?.summary
  if (!summary) return []
  if (data.value?.role === 'user') {
    return [
      { label: 'Kg recycled', value: `${formatNumber(Number(summary.kgRecycled ?? 0))} kg` },
      { label: 'Total payout', value: formatNaira(Number(summary.totalPayoutNgn ?? 0)) },
      { label: 'Materials recycled', value: String(summary.materialsRecycled ?? 0) }
    ]
  }
  if (data.value?.role === 'recycler') {
    return [
      { label: 'Value purchased', value: formatNaira(Number(summary.valuePurchasedNgn ?? 0)) },
      { label: 'Average pickup size', value: `${formatNumber(Number(summary.averagePickupSizeKg ?? 0))} kg` },
      { label: 'Completed requests', value: String(summary.completedRequests ?? 0) }
    ]
  }
  return [
    { label: 'Kg diverted', value: `${formatNumber(Number(summary.kgDiverted ?? 0))} kg` },
    { label: 'Active statuses', value: String(summary.activeStatuses ?? 0) },
    { label: 'Total payouts', value: formatNaira(Number(summary.totalPayoutsNgn ?? 0)) }
  ]
})

function series(key: string) {
  return data.value?.charts?.[key] ?? []
}

function labels(key: string) {
  return series(key).map(entry => entry.label)
}

function values(key: string) {
  return series(key).map(entry => entry.value)
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Analytics</p>
        <h1 class="page-title">{{ roleTitle }}</h1>
        <p class="muted workspace-intro">
          Live aggregations for your role — measured kg, payouts, and utilization only.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseButton variant="ghost" size="sm" @click="refresh()">Refresh</BaseButton>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" variant="dashboard" label="Loading analytics" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load analytics" description="Try again in a moment.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <template v-else-if="data">
      <DashboardMetrics :metrics="summaryCards" />

      <div class="dash-grid analytics-grid">
        <DashboardSection
          v-if="data.role === 'user' || data.role === 'admin' || data.role === 'recycler'"
          title="Waste material distribution"
          description="Material share by weight."
        >
          <AnalyticsChart
            type="doughnut"
            :loading="pending"
            :labels="labels(data.role === 'recycler' ? 'supplyByMaterial' : data.role === 'user' ? 'materialDistribution' : 'wasteByMaterial')"
            :values="values(data.role === 'recycler' ? 'supplyByMaterial' : data.role === 'user' ? 'materialDistribution' : 'wasteByMaterial')"
            dataset-label="Kg by material"
            empty-title="No material data yet"
            empty-description="Completed collections will populate this chart."
          />
        </DashboardSection>

        <DashboardSection
          :title="data.role === 'recycler' ? 'Completed requests by month' : 'Kg recycled over time'"
          :description="data.role === 'recycler'
            ? 'Completed pickup jobs each month.'
            : 'Monthly recycled weight.'"
        >
          <AnalyticsChart
            type="line"
            :loading="pending"
            :labels="labels(data.role === 'recycler' ? 'completedByMonth' : 'kgOverTime')"
            :values="values(data.role === 'recycler' ? 'completedByMonth' : 'kgOverTime')"
            :dataset-label="data.role === 'recycler' ? 'Completed requests' : 'Kg recycled'"
            empty-title="No time-series yet"
            empty-description="Monthly activity appears after completed pickups."
          />
        </DashboardSection>

        <DashboardSection
          :title="data.role === 'recycler' ? 'Value purchased by month' : 'Monthly payouts'"
          :description="data.role === 'recycler'
            ? 'Expected payout value completed each month.'
            : 'NGN rewards by month.'"
        >
          <AnalyticsChart
            type="bar"
            :loading="pending"
            :labels="labels(data.role === 'recycler' ? 'monthlyPurchaseValue' : 'monthlyPayouts')"
            :values="values(data.role === 'recycler' ? 'monthlyPurchaseValue' : 'monthlyPayouts')"
            dataset-label="NGN"
            empty-title="No payout history"
            empty-description="Rewards show here after completed pickups."
          />
        </DashboardSection>

        <DashboardSection
          v-if="data.role === 'admin'"
          title="Recycler utilization"
          description="Daily load versus capacity."
        >
          <AnalyticsChart
            type="bar"
            horizontal
            :loading="pending"
            :labels="labels('recyclerUtilization')"
            :values="values('recyclerUtilization')"
            dataset-label="Utilization %"
            empty-title="No recycler profiles"
            empty-description="Recyclers appear here with capacity load."
          />
        </DashboardSection>

        <DashboardSection
          v-if="data.role === 'admin'"
          title="Request status distribution"
          description="How pickups are spread across the lifecycle."
        >
          <AnalyticsChart
            type="doughnut"
            :loading="pending"
            :labels="labels('statusDistribution')"
            :values="values('statusDistribution')"
            dataset-label="Requests"
            empty-title="No requests yet"
            empty-description="Status counts appear once pickups are created."
          />
        </DashboardSection>

        <DashboardSection
          v-if="data.role === 'admin'"
          title="Geographic / zone distribution"
          description="Kg attributed to nearest African area."
        >
          <AnalyticsChart
            type="bar"
            :loading="pending"
            :labels="labels('zoneDistribution')"
            :values="values('zoneDistribution')"
            dataset-label="Kg by zone"
            empty-title="No geo distribution yet"
            empty-description="Pickup locations map to African zones when requests exist."
          />
        </DashboardSection>
      </div>
    </template>
  </div>
</template>
