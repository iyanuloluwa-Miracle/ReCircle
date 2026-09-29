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
  unfinishedScans: Array<{
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
    { label: 'Active pickups', value: String(m?.activePickups ?? 0) },
    { label: 'Recycling streak', value: `${m?.recyclingStreakDays ?? 0} day${(m?.recyclingStreakDays ?? 0) === 1 ? '' : 's'}` },
    { label: 'Waste diverted', value: `${formatNumber(m?.wasteDivertedKg ?? 0)} kg` }
  ]
})

function onUpdated() {
  void refresh()
}

function scanLink(scan: ConsumerDashboard['unfinishedScans'][number]) {
  if (scan.status === 'draft' || scan.status === 'analyzed') return `/scan/${scan.id}/analysis`
  return `/scan/${scan.id}/match`
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

let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshTimer = setInterval(() => { void refresh() }, 15_000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Consumer workspace</p>
        <h1 class="page-title">Welcome back, {{ firstName }}.</h1>
        <p class="muted workspace-intro">
          Track open pickups, finish unfinished scans, then withdraw rewards when you are ready.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseButton to="/scan" class="dash-cta">Scan waste</BaseButton>
        <BaseButton to="/dashboard/history" variant="secondary" class="dash-cta">History</BaseButton>
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
        <DashboardSection
          class="dash-span-2"
          title="Active pickups"
          description="Requests still moving through the lifecycle."
        >
          <template #action>
            <BaseButton to="/dashboard/history" size="sm" variant="ghost">View history</BaseButton>
          </template>
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

        <DashboardSection title="Finish these scans" description="Drafts and matches that still need your next step.">
          <template #action>
            <BaseButton to="/dashboard/history" size="sm" variant="ghost">All scans</BaseButton>
          </template>
          <div v-if="data.unfinishedScans.length" class="scan-strip">
            <NuxtLink
              v-for="scan in data.unfinishedScans"
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
            title="No unfinished scans"
            description="Everything is matched or completed. Scan something new when you are ready."
          >
            <BaseButton to="/scan" size="sm">Scan waste</BaseButton>
          </EmptyState>
        </DashboardSection>

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
