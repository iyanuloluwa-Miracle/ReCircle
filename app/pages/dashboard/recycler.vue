<script setup lang="ts">
import { formatNaira } from '~~/utils/format'
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
  capacity: {
    capacityKgPerDay: number
    currentLoadKg: number
    remainingCapacityKg: number
    utilizationPct: number
  } | null
}

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { data, pending, error, refresh } = await useAsyncData('recycler-dashboard', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<RecyclerDashboard>('/api/dashboard/recycler')
})

const topUpAmount = ref('5000')
const toppingUp = ref(false)
const verifyingTopUp = ref(false)

const incomingCount = computed(() => data.value?.incoming.length ?? 0)

async function verifyTopUpFromCallback() {
  if (!import.meta.client || verifyingTopUp.value) return
  const reference = typeof route.query.reference === 'string'
    ? route.query.reference
    : typeof route.query.trxref === 'string'
      ? route.query.trxref
      : null
  if (!reference || !reference.startsWith('topup_')) return

  verifyingTopUp.value = true
  try {
    const result = await $fetch<{
      handled: boolean
      alreadyApplied?: boolean
      amount?: number
      available?: number
      reason?: string
    }>('/api/wallet/top-up/verify', {
      method: 'POST',
      body: { reference }
    })
    await refresh()
    if (result.handled && (result.alreadyApplied || result.reason === 'already_applied')) {
      toast.success('Wallet already updated', 'This top-up was credited earlier.')
    } else if (result.handled && result.reason === 'credited' && result.amount != null) {
      toast.success(
        'Wallet topped up',
        `${formatNaira(result.amount)} added. Available: ${formatNaira(result.available ?? 0)}.`
      )
    } else {
      toast.error('Top-up not credited yet', result.reason || 'Payment is still confirming. Refresh in a moment.')
    }
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? String((error.data as { statusMessage?: string })?.statusMessage || 'Could not verify top-up')
      : 'Could not verify top-up'
    toast.error('Top-up verification failed', message)
  } finally {
    verifyingTopUp.value = false
    const nextQuery = { ...route.query }
    delete nextQuery.reference
    delete nextQuery.trxref
    await router.replace({ path: route.path, query: nextQuery })
  }
}

onMounted(() => {
  void verifyTopUpFromCallback()
})

const metrics = computed(() => {
  const m = data.value?.metrics
  return [
    { label: 'Wallet available', value: formatNaira(m?.walletAvailableNgn ?? 0) },
    { label: 'Locked on pickups', value: formatNaira(m?.walletReservedNgn ?? 0) },
    { label: 'Collections completed', value: String(m?.completedCollections ?? 0), detail: 'Full list in History' },
    { label: 'Jobs today', value: String(m?.jobsToday ?? 0) }
  ]
})

function onUpdated() {
  void refresh()
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
        <BaseButton to="/dashboard/incoming" class="dash-cta">
          Incoming matches{{ incomingCount ? ` (${incomingCount})` : '' }}
        </BaseButton>
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
        <DashboardSection title="Wallet" description="Available funds can accept new pickups. Locked funds stay held until you confirm collection.">
          <form class="wallet-topup" @submit.prevent="topUpWallet">
            <p class="muted">
              Available {{ formatNaira(data.metrics.walletAvailableNgn ?? 0) }}
              · Locked on pickups {{ formatNaira(data.metrics.walletReservedNgn ?? 0) }}
            </p>
            <label>
              Top-up amount (₦)
              <input v-model="topUpAmount" type="number" min="100" step="100" required>
            </label>
            <BaseButton type="submit" size="sm" :loading="toppingUp">Top up wallet</BaseButton>
          </form>
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

        <DashboardSection
          class="dash-span-2"
          title="Accepted pickups"
          description="Accepted and in-transit jobs."
        >
          <template #action>
            <BaseButton to="/dashboard/history" size="sm" variant="ghost">View history</BaseButton>
          </template>
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
          >
            <BaseButton to="/dashboard/incoming" size="sm">Check incoming</BaseButton>
          </EmptyState>
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
  max-width: 16rem;
  padding: .55rem .7rem;
  border: 1px solid #c9d6b8;
  border-radius: .55rem;
}
</style>
