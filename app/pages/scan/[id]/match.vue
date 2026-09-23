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

const imageFailed = ref(false)
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
  <div class="scan-workspace">
    <header class="scan-page-heading"><div><p class="scan-eyebrow">Good for your pocket. Better for the planet.</p><h1>Find its next home<span>.</span></h1><p>Compare real recycler offers and take the next step toward pickup.</p></div><span class="scan-heading-chip"><ScanIcon name="pin" :size="16" /> Local recycler matching</span></header>
    <ScanSteps :current="3" :item-id="id" />
    <div v-if="pending" class="scan-loading-layout" role="status" aria-label="Finding recycler offers"><div class="scan-loading-photo" /><div class="scan-panel"><LoadingSkeleton :lines="6" label="Finding eligible recyclers" /></div></div>
    <section v-else-if="itemError || !item" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="image" :size="28" /></span><h2>We couldn’t load this item.</h2><p>It may be unavailable or belong to another account. Try again or start with a new photo.</p><div class="scan-inline-actions"><BaseButton @click="refreshItem()">Try again</BaseButton><BaseButton to="/scan" variant="ghost">Back to scanner</BaseButton></div></section>
    <section v-else-if="!item.weightKg" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="scale" :size="28" /></span><h2>A little detail makes a difference.</h2><p>Add your item’s weight so recyclers can give you a meaningful offer.</p><BaseButton :to="`/scan/${id}/analysis`">Add item weight<ScanIcon name="arrow" :size="17" /></BaseButton></section>
    <div v-else class="scan-matches-layout">
      <div class="scan-matches-grid">
        <aside class="scan-value-aside">
          <section class="scan-value-card" aria-labelledby="item-value"><div class="scan-value-top"><span class="scan-dark-icon"><ScanIcon name="leaf" :size="24" /></span><span class="scan-mini-label">YOUR ITEM’S POTENTIAL</span></div><p class="scan-value-label">Estimated value</p><h2 id="item-value"><template v-if="valueMin != null && valueMax != null">{{ formatNaira(valueMin) }}<span v-if="valueMin !== valueMax">– {{ formatNaira(valueMax) }}</span></template><template v-else>Not available yet</template></h2><p>Based on {{ item.weightKg }} kg of {{ item.materialCode }} and published recycler prices.</p><div class="scan-value-divider" /><div class="scan-value-footer"><ScanIcon name="shield" :size="17" /><span>Offers from eligible local recyclers</span></div></section>
          <div class="scan-item-summary"><img v-if="!imageFailed" :src="item.imageUrl" alt="Your recyclable item" @error="imageFailed = true"><span v-else class="scan-thumbnail-placeholder" role="img" aria-label="Item photo unavailable"><ScanIcon name="image" :size="24" /></span><div><strong>{{ item.itemName || item.materialCode || 'Your item' }}</strong><span>{{ item.materialCode }}<span aria-hidden="true"> · </span>{{ item.weightKg }} kg</span><NuxtLink :to="`/scan/${id}/analysis`">Review item<ScanIcon name="chevron" :size="12" /></NuxtLink></div></div>
          <div v-if="!activeRequest" class="scan-matching-explanation"><h3>How we find your match</h3><p>We consider material, distance, price and available capacity to find a recycler that fits.</p><div><ScanIcon name="pin" :size="17" /><span>{{ matches.length }} eligible {{ matches.length === 1 ? 'recycler' : 'recyclers' }} found</span></div></div>
        </aside>

        <section v-if="activeRequest" class="scan-panel scan-request-panel"><span class="scan-heading-chip"><ScanIcon name="check" :size="16" /> Pickup request created</span><h2>{{ activeRequest.businessName || 'Assigned recycler' }}</h2><p class="scan-request-status">{{ activeRequest.status.replaceAll('_', ' ') }}</p><div class="scan-request-payout"><span>Expected payout</span><strong>{{ formatNaira(activeRequest.expectedPayout) }}</strong></div><StatusTimeline :steps="activeRequest.timeline" /><BaseButton to="/dashboard/user" class="scan-full-button">Open my requests<ScanIcon name="arrow" :size="17" /></BaseButton></section>
        <section v-else-if="recommended" class="scan-panel scan-recommended-panel" aria-labelledby="best-match">
          <header class="scan-recycler-heading"><div><span class="scan-recommended-label"><ScanIcon name="sparkles" :size="14" /> YOUR BEST MATCH</span><h2 id="best-match">{{ recommended.businessName }}</h2><p><ScanIcon name="pin" :size="15" />{{ distanceLabel(recommended.distanceKm) }}</p></div><span class="scan-recycler-symbol"><ScanIcon name="building" :size="27" /></span></header>
          <div class="scan-offer-row"><div><span>Expected payout</span><strong>{{ formatNaira(recommended.expectedPayout) }}</strong></div><div><span>Price per kg</span><strong>{{ formatNaira(recommended.pricePerKg) }}<small> / kg</small></strong></div></div>
          <div class="scan-recycler-metrics"><div><span>Match score</span><strong>{{ recommended.matchScore }}<small> / 100</small></strong></div><div><span>Available capacity</span><strong>{{ recommended.remainingCapacityKg.toLocaleString('en-NG') }}<small> kg</small></strong></div></div>
          <div class="scan-match-reasons"><h3>A good fit for your item</h3><ul><li v-for="reason in recommended.whySelected" :key="reason"><ScanIcon name="check" :size="15" /><span>{{ reason }}</span></li></ul><details v-if="recommended.reasons.length" class="scan-match-detail"><summary>See matching details<ScanIcon name="chevron" :size="13" /></summary><ul><li v-for="reason in recommended.reasons" :key="reason">{{ reason }}</li></ul></details></div>
          <BaseButton class="scan-full-button" :loading="requestingId === recommended.recyclerId" :disabled="!!requestingId" @click="requestPickup(recommended.recyclerId)">Request pickup<ScanIcon v-if="!requestingId" name="arrow" :size="17" /></BaseButton>
          <button v-if="matches.length > 1" type="button" class="scan-compare-toggle" :aria-expanded="comparing" aria-controls="recycler-comparison" @click="comparing = !comparing">{{ comparing ? 'Hide comparison' : `Compare ${matches.length} recyclers` }}<ScanIcon name="chevron" :size="14" :class="{ 'is-open': comparing }" /></button>
        </section>
        <section v-else-if="!pastMatching(item.status)" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon :name="matchError ? 'refresh' : 'pin'" :size="28" /></span><h2>{{ matchError ? 'The search hit a snag.' : 'Your next match is still out there.' }}</h2><p>{{ matchError ? 'We couldn’t load recycler offers right now. Please try again.' : 'No recycler nearby currently accepts this material with enough capacity and a published price. You can review your item or try again later.' }}</p><div class="scan-inline-actions"><BaseButton @click="refreshMatch()"><ScanIcon name="refresh" :size="17" />Try matching again</BaseButton><BaseButton :to="`/scan/${id}/analysis`" variant="ghost">Review material & weight</BaseButton></div></section>
        <section v-else class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="check" :size="28" /></span><h2>Your item is on its way.</h2><p>Continue to your dashboard to follow its pickup progress.</p><BaseButton to="/dashboard/user">View my requests<ScanIcon name="arrow" :size="17" /></BaseButton></section>
      </div>

      <section v-if="comparing && matches.length && !activeRequest" id="recycler-comparison" class="scan-comparison-section" aria-labelledby="comparison-heading"><header><div><p class="scan-eyebrow">Your options, side by side</p><h2 id="comparison-heading">Choose the right fit.</h2></div><span>{{ matches.length }} eligible recyclers</span></header><div class="scan-comparison-grid"><article v-for="(row, index) in matches" :key="row.recyclerId" class="scan-comparison-card" :class="{ 'is-recommended': row.recyclerId === recommended?.recyclerId }"><div class="scan-comparison-rank"><span v-if="row.recyclerId === recommended?.recyclerId"><ScanIcon name="sparkles" :size="13" /> Recommended</span><span v-else>Option {{ index + 1 }}</span><strong>{{ row.matchScore }}<small> / 100</small></strong></div><h3>{{ row.businessName }}</h3><p class="scan-comparison-distance"><ScanIcon name="pin" :size="14" />{{ distanceLabel(row.distanceKm) }}</p><div class="scan-comparison-payout"><span>Expected payout</span><strong>{{ formatNaira(row.expectedPayout) }}</strong><small>{{ formatNaira(row.pricePerKg) }} per kg</small></div><ul><li v-for="reason in row.reasons" :key="reason">{{ reason }}</li></ul><BaseButton size="sm" :variant="row.recyclerId === recommended?.recyclerId ? 'primary' : 'ghost'" :loading="requestingId === row.recyclerId" :disabled="!!requestingId" @click="requestPickup(row.recyclerId)">Request this recycler<ScanIcon v-if="!requestingId" name="arrow" :size="15" /></BaseButton></article></div></section>
      <p v-if="actionError" class="scan-alert scan-alert--error" role="alert">{{ actionError }}</p>
      <footer class="scan-flow-footer"><BaseButton :to="`/scan/${id}/analysis`" variant="ghost" size="sm"><ScanIcon name="arrow" :size="16" class="scan-back-arrow" />Back to analysis</BaseButton><BaseButton to="/scan" variant="ghost" size="sm"><ScanIcon name="camera" :size="17" />Scan another item</BaseButton></footer>
    </div>
  </div>
</template>
