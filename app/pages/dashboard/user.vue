<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Consumer workspace — ReCircle', robots: 'noindex' })

interface ConsumerDashboard {
  user: { name: string; email: string; isDemo: boolean }
  metrics: {
    wasteDivertedKg: number
    totalEarnedNgn: number
    activePickups: number
    recyclingStreakDays: number
  }
  activePickups: PickupRequestView[]
  recentScans: Array<{
    id: string
    imageUrl: string
    itemName: string | null
    materialCode: string | null
    status: string
    weightKg: number | null
    estimatedValueMin: number | null
    estimatedValueMax: number | null
    createdAt: string | null
  }>
  walletActivity: Array<{
    id: string
    amount: number
    currency: string
    status: string
    provider: string
    createdAt: string | null
  }>
  tips: Array<{ title: string; body: string }>
}

const { data, pending, error, refresh } = await useAsyncData('consumer-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<ConsumerDashboard>('/api/dashboard/user')
})

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Waste diverted', value: `${formatNumber(m?.wasteDivertedKg ?? 0)} kg` },
    { label: 'Total earned', value: formatNaira(m?.totalEarnedNgn ?? 0) },
    { label: 'Active pickups', value: String(m?.activePickups ?? 0) },
    { label: 'Recycling streak', value: `${m?.recyclingStreakDays ?? 0} day${(m?.recyclingStreakDays ?? 0) === 1 ? '' : 's'}` }
  ]
})

function onUpdated() {
  refresh()
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div>
        <p class="eyebrow">Consumer workspace</p>
        <h1 class="page-title">Your recycling at a glance.</h1>
        <p class="muted workspace-intro">Live totals from your scans, pickups, and mock rewards — nothing invented on the page.</p>
      </div>
      <BaseButton to="/scan" class="dash-cta">Scan waste</BaseButton>
    </div>

    <LoadingSkeleton v-if="pending" :lines="8" label="Loading consumer dashboard" />
    <BaseCard v-else-if="error">
      <EmptyState title="Could not load your dashboard" description="Check your connection and try again.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <template v-else-if="data">
      <DashboardMetrics :metrics="metrics" />

      <div class="dash-grid">
        <DashboardSection title="Active pickup" description="Requests still moving through the lifecycle.">
          <div v-if="data.activePickups.length" class="request-list">
            <RequestCard
              v-for="request in data.activePickups"
              :key="request.id"
              :request="request"
              role="user"
              @updated="onUpdated"
            />
          </div>
          <EmptyState
            v-else
            title="No active pickups"
            description="Match a recycler and request pickup to track progress here."
          >
            <BaseButton to="/scan">Scan waste</BaseButton>
          </EmptyState>
        </DashboardSection>

        <DashboardSection title="Recent scans" description="Your latest waste items from MongoDB.">
          <div v-if="data.recentScans.length" class="scan-strip">
            <NuxtLink
              v-for="scan in data.recentScans"
              :key="scan.id"
              class="scan-chip"
              :to="scan.status === 'draft' || scan.status === 'analyzed' || scan.status === 'matched'
                ? `/scan/${scan.id}/${scan.status === 'draft' || scan.status === 'analyzed' ? 'analysis' : 'match'}`
                : '/dashboard/user'"
            >
              <img :src="scan.imageUrl" :alt="scan.itemName || 'Waste scan'">
              <div>
                <strong>{{ scan.itemName || scan.materialCode || 'Draft item' }}</strong>
                <span class="muted">{{ scan.status.replaceAll('_', ' ') }}{{ scan.weightKg != null ? ` · ${formatNumber(scan.weightKg)} kg` : '' }}</span>
              </div>
            </NuxtLink>
          </div>
          <EmptyState
            v-else
            title="No scans yet"
            description="Upload a photo to start your first draft."
          >
            <BaseButton to="/scan">Scan waste</BaseButton>
          </EmptyState>
        </DashboardSection>

        <DashboardSection title="Wallet activity" description="Completed mock recycling rewards.">
          <ul v-if="data.walletActivity.length" class="wallet-list">
            <li v-for="entry in data.walletActivity" :key="entry.id">
              <div>
                <strong>{{ formatNaira(entry.amount) }}</strong>
                <span class="muted">{{ entry.provider }} · {{ entry.status }}</span>
              </div>
              <time v-if="entry.createdAt" :datetime="entry.createdAt">{{ new Date(entry.createdAt).toLocaleDateString('en-NG') }}</time>
            </li>
          </ul>
          <EmptyState
            v-else
            title="No wallet activity"
            description="Rewards appear after a recycler marks a pickup completed."
          />
        </DashboardSection>

        <DashboardSection title="Recycling tips" description="Practical habits that improve acceptance and payout quality.">
          <ul class="tips-list">
            <li v-for="tip in data.tips" :key="tip.title">
              <strong>{{ tip.title }}</strong>
              <p class="muted">{{ tip.body }}</p>
            </li>
          </ul>
        </DashboardSection>
      </div>
    </template>
  </div>
</template>
