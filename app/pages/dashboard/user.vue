<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Consumer workspace — ReCircle', robots: 'noindex' })

interface ConsumerDashboard {
  user: { name: string; email: string; isDemo: boolean }
  metrics: {
    wasteDivertedKg: number
    walletAvailableNgn: number
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
    type: string
    provider: string
    failureReason: string | null
    createdAt: string | null
  }>
  tips: Array<{ title: string; body: string }>
}

const { user } = useAuth()
const toast = useToast()
const { data, pending, error, refresh } = await useAsyncData('consumer-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<ConsumerDashboard>('/api/dashboard/user')
})

const firstName = computed(() => user.value?.name?.split(/\s+/)[0] || 'there')
const withdrawAmount = ref('')
const withdrawing = ref(false)

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Wallet balance', value: formatNaira(m?.walletAvailableNgn ?? 0) },
    { label: 'Lifetime earned', value: formatNaira(m?.totalEarnedNgn ?? 0) },
    { label: 'Waste diverted', value: `${formatNumber(m?.wasteDivertedKg ?? 0)} kg` },
    { label: 'Active pickups', value: String(m?.activePickups ?? 0) }
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

function ledgerLabel(type: string) {
  const labels: Record<string, string> = {
    settle_credit: 'Pickup reward',
    withdraw: 'Withdrawal',
    withdraw_failed: 'Withdrawal restored',
    top_up: 'Top-up'
  }
  return labels[type] || type.replaceAll('_', ' ')
}

async function withdraw() {
  const amount = Number(withdrawAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error('Enter an amount', 'Choose how much to withdraw from your wallet.')
    return
  }
  withdrawing.value = true
  try {
    const result = await $fetch<{ amount: number; available: number; status: string; demo?: boolean }>('/api/wallet/withdraw', {
      method: 'POST',
      body: { amount }
    })
    withdrawAmount.value = ''
    await refresh()
    toast.success(
      result.demo ? 'Demo withdrawal recorded' : 'Withdrawal started',
      result.demo
        ? `${formatNaira(result.amount)} debited from your wallet (Paystack not configured).`
        : `${formatNaira(result.amount)} is on its way to your bank account.`
    )
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? String((error.data as { statusMessage?: string })?.statusMessage || 'Could not withdraw')
      : 'Could not withdraw'
    toast.error('Withdrawal failed', message)
  } finally {
    withdrawing.value = false
  }
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Consumer workspace</p>
        <h1 class="page-title">Welcome back, {{ firstName }}.</h1>
        <p class="muted workspace-intro">
          Rewards land in your wallet when a recycler completes a pickup. Withdraw to your bank when you are ready.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseButton to="/scan" class="dash-cta">Scan waste</BaseButton>
        <BaseButton to="/dashboard/settings" variant="secondary" class="dash-cta">Bank settings</BaseButton>
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
        <DashboardSection title="Withdraw" description="Send available wallet balance to your saved NUBAN.">
          <form class="withdraw-form" @submit.prevent="withdraw">
            <label>
              Amount (₦)
              <input v-model="withdrawAmount" type="number" min="100" step="1" :max="data.metrics.walletAvailableNgn" placeholder="1000" required>
            </label>
            <p class="muted">Available: {{ formatNaira(data.metrics.walletAvailableNgn) }}</p>
            <div class="withdraw-actions">
              <BaseButton type="submit" size="sm" :loading="withdrawing" :disabled="data.metrics.walletAvailableNgn < 100">
                Withdraw
              </BaseButton>
              <BaseButton to="/dashboard/settings" size="sm" variant="ghost">Manage bank account</BaseButton>
            </div>
          </form>
        </DashboardSection>

        <DashboardSection title="Active pickups" description="Requests still moving through the lifecycle.">
          <div v-if="data.activePickups.length" class="request-list">
            <RequestCard
              v-for="request in data.activePickups"
              :key="request.id"
              :request="request"
              role="user"
              :detail-link="`/dashboard/pickups/${request.id}`"
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

        <DashboardSection title="Wallet history" description="Earnings and withdrawals from your ledger.">
          <ul v-if="data.walletActivity.length" class="wallet-list">
            <li v-for="entry in data.walletActivity" :key="entry.id">
              <div>
                <strong>{{ formatNaira(entry.amount) }}</strong>
                <span class="muted">{{ ledgerLabel(entry.type) }}</span>
                <span v-if="entry.failureReason" class="muted">{{ entry.failureReason }}</span>
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
            description="Rewards appear when a recycler completes a pickup. Add a bank account in Settings before withdrawing."
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

<style scoped>
.withdraw-form {
  display: grid;
  gap: .75rem;
}
.withdraw-form label {
  display: grid;
  gap: .35rem;
  font-size: .85rem;
  font-weight: 600;
}
.withdraw-form input {
  max-width: 16rem;
  padding: .55rem .7rem;
  border: 1px solid #c9d6b8;
  border-radius: .55rem;
}
.withdraw-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}
</style>
