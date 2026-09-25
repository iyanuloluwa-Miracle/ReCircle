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
    failureReason: string | null
    createdAt: string | null
  }>
  tips: Array<{ title: string; body: string }>
}

const { user } = useAuth()
const { data, pending, error, refresh } = await useAsyncData('consumer-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<ConsumerDashboard>('/api/dashboard/user')
})

const firstName = computed(() => user.value?.name?.split(/\s+/)[0] || 'there')

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

function scanLink(scan: ConsumerDashboard['recentScans'][number]) {
  if (scan.status === 'draft' || scan.status === 'analyzed') return `/scan/${scan.id}/analysis`
  if (scan.status === 'matched') return `/scan/${scan.id}/match`
  return '/dashboard/user'
}

function walletProviderLabel(provider: string) {
  if (provider === 'paystack') return 'Paystack'
  if (provider === 'mock') return 'Demo'
  return provider
}

function walletStatusLabel(status: string) {
  if (status === 'completed') return 'completed'
  if (status === 'pending') return 'pending'
  if (status === 'failed') return 'failed'
  return status
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Consumer workspace</p>
        <h1 class="page-title">Welcome back, {{ firstName }}.</h1>
        <p class="muted workspace-intro">
          Live totals from your scans, pickups, and rewards — pulled straight from your account.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseButton to="/scan" class="dash-cta">Scan waste</BaseButton>
        <BaseButton to="/dashboard/analytics" variant="secondary" class="dash-cta">View analytics</BaseButton>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" variant="dashboard" label="Loading consumer dashboard" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load your dashboard" description="Check your connection and try again.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <template v-else-if="data">
      <DashboardMetrics :metrics="metrics" />

      <div class="dash-grid">
        <DashboardSection title="Active pickups" description="Requests still moving through the lifecycle.">
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
            compact
            symbol="◈"
            title="No active pickups"
            description="Match a recycler and request pickup to track progress here."
          >
            <BaseButton to="/scan" size="sm">Scan waste</BaseButton>
          </EmptyState>
        </DashboardSection>

        <DashboardSection title="Recent scans" description="Your latest waste items.">
          <div v-if="data.recentScans.length" class="scan-strip">
            <NuxtLink
              v-for="scan in data.recentScans"
              :key="scan.id"
              class="scan-chip"
              :to="scanLink(scan)"
            >
              <WasteThumb :src="scan.imageUrl" :alt="scan.itemName || 'Waste scan'" />
              <div class="scan-chip-copy">
                <strong>{{ scan.itemName || scan.materialCode || 'Draft item' }}</strong>
                <span class="muted">
                  {{ scan.status.replaceAll('_', ' ') }}{{ scan.weightKg != null ? ` · ${formatNumber(scan.weightKg)} kg` : '' }}
                </span>
              </div>
            </NuxtLink>
          </div>
          <EmptyState
            v-else
            compact
            symbol="▣"
            title="No scans yet"
            description="Upload a photo to start your first draft."
          >
            <BaseButton to="/scan" size="sm">Scan waste</BaseButton>
          </EmptyState>
        </DashboardSection>

        <DashboardSection title="Wallet activity" description="Recycling rewards from completed pickups.">
          <ul v-if="data.walletActivity.length" class="wallet-list">
            <li v-for="entry in data.walletActivity" :key="entry.id">
              <div>
                <strong>{{ formatNaira(entry.amount) }}</strong>
                <span class="muted">
                  {{ walletProviderLabel(entry.provider) }} · {{ walletStatusLabel(entry.status) }}
                </span>
                <span v-if="entry.status === 'failed' && entry.failureReason" class="muted">
                  {{ entry.failureReason }}
                </span>
              </div>
              <time v-if="entry.createdAt" :datetime="entry.createdAt">
                {{ new Date(entry.createdAt).toLocaleDateString('en-NG') }}
              </time>
            </li>
          </ul>
          <EmptyState
            v-else
            compact
            symbol="◈"
            title="No wallet activity"
            description="Rewards appear after a recycler marks a pickup completed. Add a payout bank account in Settings to receive Paystack TEST transfers."
          />
        </DashboardSection>

        <DashboardSection title="Recycling tips" description="Habits that improve acceptance and payout quality.">
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
