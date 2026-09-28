<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Recycler workspace — ReCircle', robots: 'noindex' })

interface RecyclerDashboard {
  user: { name: string; email: string; isDemo: boolean }
  recycler: {
    businessName: string
    availability: 'available' | 'busy' | 'offline'
    businessHours: string
    operatingHours: Array<{ day: number; open: string; close: string; enabled: boolean }>
    contactPhone: string | null
    serviceRadiusKm: number
    capacityKgPerDay: number
    acceptedMaterials: string[]
    pricingRules: Array<{ material: string; pricePerKg: number; currency: 'NGN' }>
    walletAvailable?: number
    walletReserved?: number
  } | null
  metrics: {
    availableSupplyKg: number
    jobsToday: number
    potentialPurchaseValueNgn: number
    completedCollections: number
    walletAvailableNgn?: number
    walletReservedNgn?: number
  }
  incoming: PickupRequestView[]
  acceptedPickups: PickupRequestView[]
  completedPickups: PickupRequestView[]
  materialBreakdown: Array<{ materialCode: string; weightKg: number; count: number; valueNgn: number }>
  capacity: {
    capacityKgPerDay: number
    currentLoadKg: number
    remainingCapacityKg: number
    utilizationPct: number
  } | null
}

const toast = useToast()
const { data, pending, error, refresh } = await useAsyncData('recycler-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<RecyclerDashboard>('/api/dashboard/recycler')
})

const topUpAmount = ref('5000')
const toppingUp = ref(false)

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Wallet available', value: formatNaira(m?.walletAvailableNgn ?? 0) },
    { label: 'Wallet reserved', value: formatNaira(m?.walletReservedNgn ?? 0) },
    { label: 'Available supply', value: `${formatNumber(m?.availableSupplyKg ?? 0)} kg` },
    { label: 'Jobs today', value: String(m?.jobsToday ?? 0) }
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

async function topUpWallet() {
  const amount = Number(topUpAmount.value)
  if (!Number.isFinite(amount) || amount < 100) {
    toast.error('Enter an amount', 'Minimum top-up is ₦100.')
    return
  }
  toppingUp.value = true
  try {
    // Prefer Paystack Checkout when configured; otherwise demo credit for local flows.
    try {
      const paystack = await $fetch<{ authorizationUrl: string; amount: number }>('/api/wallet/top-up', {
        method: 'POST',
        body: { amount }
      })
      if (import.meta.client && paystack.authorizationUrl) {
        window.location.href = paystack.authorizationUrl
        return
      }
    } catch (paystackError) {
      const message = paystackError && typeof paystackError === 'object' && 'data' in paystackError
        ? String((paystackError.data as { statusMessage?: string })?.statusMessage || '')
        : ''
      if (!message.toLowerCase().includes('demo top-up') && !message.toLowerCase().includes('not configured')) {
        throw paystackError
      }
      const demo = await $fetch<{ amount: number; available: number }>('/api/wallet/top-up/demo', {
        method: 'POST',
        body: { amount }
      })
      await refresh()
      toast.success('Demo top-up complete', `${formatNaira(demo.amount)} added. Available: ${formatNaira(demo.available)}.`)
      return
    }
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? String((error.data as { statusMessage?: string })?.statusMessage || 'Could not top up')
      : 'Could not top up'
    toast.error('Top-up failed', message)
  } finally {
    toppingUp.value = false
  }
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Recycler workspace</p>
        <h1 class="page-title">{{ data?.recycler?.businessName || 'Your recycling desk' }}</h1>
        <p class="muted workspace-intro">
          Top up your wallet to accept pickups. Accept locks funds; complete settles them to the consumer wallet.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseBadge v-if="data?.recycler" :tone="data.recycler.availability === 'available' ? 'green' : 'warning'">
          {{ data.recycler.availability.toUpperCase() }}
        </BaseBadge>
        <BaseButton to="/dashboard/availability" variant="secondary" class="dash-cta">Manage availability</BaseButton>
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
        <DashboardSection title="Wallet" description="Available funds can accept new pickups. Reserved funds are locked on accepted jobs.">
          <form class="wallet-topup" @submit.prevent="topUpWallet">
            <p class="muted">
              Available {{ formatNaira(data.metrics.walletAvailableNgn ?? 0) }}
              · Reserved {{ formatNaira(data.metrics.walletReservedNgn ?? 0) }}
            </p>
            <label>
              Top-up amount (₦)
              <input v-model="topUpAmount" type="number" min="100" step="100" required>
            </label>
            <BaseButton type="submit" size="sm" :loading="toppingUp">Top up wallet</BaseButton>
          </form>
        </DashboardSection>

        <DashboardSection
          class="dash-span-2"
          title="Incoming matched waste"
          description="Pending requests assigned to your business. Accept locks wallet funds and reserves daily capacity."
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

        <DashboardSection
          class="dash-span-2"
          title="Completed collections"
          description="Recent pickups after you confirm collection. Active jobs stay above."
        >
          <div v-if="data.completedPickups.length" class="request-list">
            <RequestCard
              v-for="request in data.completedPickups"
              :key="request.id"
              :request="request"
              role="recycler"
              compact
              @updated="onUpdated"
            />
          </div>
          <EmptyState
            v-else
            compact
            symbol="◈"
            title="No completed collections yet"
            description="Completed pickups appear here after you confirm collection."
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

<style scoped>
.wallet-topup {
  display: grid;
  gap: .75rem;
}
.wallet-topup label {
  display: grid;
  gap: .35rem;
  font-size: .85rem;
  font-weight: 600;
}
.wallet-topup input {
  max-width: 14rem;
  padding: .55rem .7rem;
  border: 1px solid #c9d6b8;
  border-radius: .55rem;
}
</style>
