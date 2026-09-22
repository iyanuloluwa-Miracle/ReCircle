<script setup lang="ts">
import { formatNaira } from '~~/utils/format'
import type { PickupRequestView } from '../../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Waste valuation — ReCircle', robots: 'noindex' })

interface MatchRow {
  recyclerId: string
  businessName: string
  distanceKm: number
  pricePerKg: number
  currency: 'NGN'
  expectedPayout: number
  matchScore: number
  remainingCapacityKg: number
  capacityAvailablePct: number
  reasons: string[]
  whySelected: string[]
}

interface MatchResponse {
  id: string
  status: string
  weightKg: number
  materialCode: string
  currency: 'NGN'
  estimatedValueMin: number | null
  estimatedValueMax: number | null
  matches: MatchRow[]
  recommended: MatchRow | null
}

const id = String(useRoute().params.id)
const comparing = ref(false)
const requestingId = ref<string | null>(null)
const actionError = ref('')
const createdRequest = ref<PickupRequestView | null>(null)

const pastMatching = (status: string | undefined) =>
  status === 'pickup_requested' || status === 'picked_up' || status === 'completed'

const { data: item, pending: itemPending, error: itemError, refresh: refreshItem } = await useAsyncData(`waste-match-item-${id}`, async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<{
    id: string
    status: string
    weightKg: number | null
    materialCode: string | null
    itemName: string | null
    estimatedValueMin: number | null
    estimatedValueMax: number | null
    currency: string
    imageUrl: string
  }>(`/api/waste-items/${id}`)
})

const { data: matchData, pending: matchPending, error: matchError, refresh: refreshMatch } = await useAsyncData(
  `waste-match-result-${id}`,
  async () => {
    if (!item.value?.weightKg || item.value.weightKg <= 0) return null
    if (pastMatching(item.value.status)) return null
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    return fetcher<MatchResponse>('/api/match-recycler', {
      method: 'POST',
      body: { wasteItemId: id, weightKg: item.value.weightKg }
    })
  },
  { watch: [() => item.value?.weightKg, () => item.value?.status] }
)

const { data: existingRequests } = await useAsyncData(`waste-item-requests-${id}`, async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  const result = await fetcher<{ requests: PickupRequestView[] }>('/api/requests')
  return result.requests.filter(entry => entry.wasteItemId === id)
}, { watch: [() => item.value?.status] })

watch(matchError, (error) => {
  actionError.value = error ? 'Could not match recyclers. Please try again.' : ''
})

const pending = computed(() => itemPending.value || matchPending.value)
const recommended = computed(() => matchData.value?.recommended ?? null)
const matches = computed(() => matchData.value?.matches ?? [])
const valueMin = computed(() => matchData.value?.estimatedValueMin ?? item.value?.estimatedValueMin ?? null)
const valueMax = computed(() => matchData.value?.estimatedValueMax ?? item.value?.estimatedValueMax ?? null)
const activeRequest = computed(() => createdRequest.value
  ?? existingRequests.value?.find(entry => entry.status !== 'cancelled' && entry.status !== 'rejected')
  ?? null)

function distanceLabel(km: number) {
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km)
  return `${rounded} km away`
}

function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const response = error.data as { statusMessage?: string }
    if (response?.statusMessage) return response.statusMessage
  }
  return fallback
}

async function requestPickup(recyclerId: string) {
  actionError.value = ''
  requestingId.value = recyclerId
  try {
    const result = await $fetch<PickupRequestView>('/api/create-request', {
      method: 'POST',
      body: { wasteItemId: id, recyclerId }
    })
    createdRequest.value = result
    await refreshItem()
    await navigateTo('/dashboard/user')
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not create the pickup request.')
  } finally {
    requestingId.value = null
  }
}
</script>

<template>
  <div class="match-step">
    <p class="eyebrow">03 / Valuation & matching</p>
    <h1 class="page-title">See what your waste is worth.</h1>
    <p class="muted workspace-intro">Prices and matches come from recycler rules and location — not from the AI classifier.</p>

    <LoadingSkeleton v-if="pending" />
    <BaseCard v-else-if="itemError">
      <EmptyState title="Could not load this item" description="The item may be unavailable or belong to another account.">
        <BaseButton to="/scan">Back to scanner</BaseButton>
      </EmptyState>
    </BaseCard>
    <BaseCard v-else-if="!item?.weightKg">
      <EmptyState title="Weight required" description="Enter the item weight on the analysis step before matching recyclers.">
        <BaseButton :to="`/scan/${id}/analysis`">Back to analysis</BaseButton>
      </EmptyState>
    </BaseCard>
    <div v-else class="match-layout">
      <section class="match-value-panel" aria-labelledby="waste-worth">
        <p class="analysis-kicker">Your waste is worth</p>
        <h2 id="waste-worth" class="match-value-range">
          <template v-if="valueMin != null && valueMax != null">
            {{ formatNaira(valueMin) }}
            <span v-if="valueMin !== valueMax"> – {{ formatNaira(valueMax) }}</span>
          </template>
          <template v-else>No eligible recyclers nearby</template>
        </h2>
        <p class="muted">Based on {{ item.weightKg }} kg of {{ item.materialCode }} and current recycler offers.</p>
      </section>

      <section v-if="activeRequest" class="match-best-panel">
        <p class="analysis-kicker">Pickup request</p>
        <h2>{{ activeRequest.businessName || 'Assigned recycler' }}</h2>
        <p class="muted">Status: {{ activeRequest.status.replaceAll('_', ' ') }} · Expected {{ formatNaira(activeRequest.expectedPayout) }}</p>
        <StatusTimeline :steps="activeRequest.timeline" />
        <BaseButton to="/dashboard/user" class="analysis-action">Open my requests</BaseButton>
      </section>

      <template v-else>
        <section v-if="recommended" class="match-best-panel" aria-labelledby="best-match">
          <p class="analysis-kicker">Best match</p>
          <h2 id="best-match">{{ recommended.businessName }}</h2>
          <div class="match-facts">
            <div><span>Distance</span><strong>{{ distanceLabel(recommended.distanceKm) }}</strong></div>
            <div><span>Offer</span><strong>NGN {{ Math.round(recommended.pricePerKg).toLocaleString('en-NG') }}/kg</strong></div>
            <div><span>Availability</span><strong>Available today</strong></div>
            <div><span>Match score</span><strong>{{ recommended.matchScore }}/100</strong></div>
          </div>
          <div class="match-why">
            <strong>Why this recycler?</strong>
            <ul>
              <li v-for="reason in recommended.whySelected" :key="reason">{{ reason }}</li>
            </ul>
            <ul class="match-detail-reasons">
              <li v-for="reason in recommended.reasons" :key="reason">{{ reason }}</li>
            </ul>
          </div>
          <BaseButton
            class="analysis-action"
            :loading="requestingId === recommended.recyclerId"
            :disabled="!!requestingId"
            @click="requestPickup(recommended.recyclerId)"
          >
            Request pickup
          </BaseButton>
          <button type="button" class="match-compare-link" @click="comparing = !comparing">
            {{ comparing ? 'Hide comparison' : 'Compare 3 recyclers' }}
          </button>
        </section>

        <EmptyState
          v-else-if="!pastMatching(item.status)"
          title="No matching recyclers"
          description="No available recycler within range accepts this material with enough capacity and a published price."
        >
          <BaseButton :to="`/scan/${id}/analysis`" variant="ghost">Adjust material or weight</BaseButton>
          <BaseButton variant="ghost" size="sm" @click="refreshMatch()">Retry matching</BaseButton>
        </EmptyState>

        <section v-if="comparing && matches.length" class="match-compare" aria-label="Recycler comparison">
          <article v-for="(row, index) in matches" :key="row.recyclerId" class="match-compare-card" :class="{ 'is-recommended': index === 0 }">
            <header>
              <BaseBadge :tone="index === 0 ? 'green' : 'lime'">{{ index === 0 ? 'RECOMMENDED' : `#${index + 1}` }}</BaseBadge>
              <h3>{{ row.businessName }}</h3>
              <p>{{ row.matchScore }}/100</p>
            </header>
            <ul>
              <li v-for="reason in row.reasons" :key="reason">{{ reason }}</li>
            </ul>
            <p class="match-payout">Expected payout {{ formatNaira(row.expectedPayout) }}</p>
            <BaseButton
              size="sm"
              :loading="requestingId === row.recyclerId"
              :disabled="!!requestingId"
              @click="requestPickup(row.recyclerId)"
            >
              Request this recycler
            </BaseButton>
          </article>
        </section>
      </template>

      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      <div class="match-actions">
        <BaseButton :to="`/scan/${id}/analysis`" variant="ghost" size="sm">Back to analysis</BaseButton>
        <BaseButton to="/scan" variant="ghost" size="sm">Scan another item</BaseButton>
      </div>
    </div>
  </div>
</template>
