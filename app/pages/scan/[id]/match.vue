<script setup lang="ts">
import { formatNaira, formatPickupTime } from '~~/utils/format'
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
  withinServiceRadius: boolean
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
const route = useRoute()
const reassigning = computed(() => String(route.query.reassign || '') === '1')
const comparing = ref(false)
const requestingId = ref<string | null>(null)
const actionError = ref('')
const toast = useToast()
const createdRequest = ref<PickupRequestView | null>(null)
const pickupTime = ref('')
const confirming = ref(false)
const selectedRecycler = ref<MatchRow | null>(null)

function localDateTimeMinimum() {
  const date = new Date(Date.now() + 30 * 60 * 1000)
  date.setSeconds(0, 0)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
const earliestPickupTime = computed(localDateTimeMinimum)

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
    if (pastMatching(item.value.status) && !reassigning.value) return null
    if (item.value.status === 'picked_up' || item.value.status === 'completed') return null
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    return fetcher<MatchResponse>('/api/match-recycler', {
      method: 'POST',
      body: { wasteItemId: id, weightKg: item.value.weightKg }
    })
  },
  { watch: [() => item.value?.weightKg, () => item.value?.status, reassigning] }
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
const activeRequest = computed(() => {
  if (reassigning.value && !createdRequest.value) return null
  return createdRequest.value
    ?? existingRequests.value?.find(entry => entry.status !== 'cancelled' && entry.status !== 'rejected')
    ?? null
})
const requestPanelChip = computed(() => {
  const status = activeRequest.value?.status
  if (status === 'completed') return 'Pickup completed'
  if (status === 'picked_up') return 'Item collected'
  if (status === 'accepted') return 'Pickup accepted'
  return 'Pickup request created'
})
const requestPanelAction = computed(() => {
  const request = activeRequest.value
  if (!request) return null
  if (request.status === 'completed') {
    return { to: '/dashboard/user', label: 'View wallet' }
  }
  return { to: `/dashboard/pickups/${request.id}`, label: 'View pickup details' }
})
const currentPendingRequest = computed(() =>
  existingRequests.value?.find(entry => entry.status === 'pending') ?? null
)
const currentRecyclerId = computed(() => currentPendingRequest.value?.recyclerId ?? null)

watch(matches, (list) => {
  if (list.length > 1) comparing.value = true
}, { immediate: true })

watch(currentPendingRequest, (request) => {
  if (reassigning.value && request?.requestedPickupTime && !pickupTime.value) {
    const date = new Date(request.requestedPickupTime)
    pickupTime.value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  }
}, { immediate: true })

function isCurrentRecycler(recyclerId: string) {
  return Boolean(reassigning.value && currentRecyclerId.value && currentRecyclerId.value === recyclerId)
}

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
      body: { wasteItemId: id, recyclerId, requestedPickupTime: pickupTime.value ? new Date(pickupTime.value).toISOString() : null }
    })
    createdRequest.value = result
    await refreshItem()
    toast.success(
      reassigning.value ? 'Recycler updated' : 'Pickup requested',
      reassigning.value
        ? 'Your pickup is now pending with the new recycler.'
        : 'The recycler has been notified of your request.'
    )
    await navigateTo('/dashboard/user')
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not create the pickup request.')
    toast.error(reassigning.value ? 'Could not change recycler' : 'Could not request pickup', actionError.value)
  } finally {
    requestingId.value = null
  }
}
function beginRequest(recycler: MatchRow) { selectedRecycler.value = recycler; confirming.value = true }
async function confirmRequest() { if (selectedRecycler.value) { confirming.value = false; await requestPickup(selectedRecycler.value.recyclerId) } }
</script>
<template>
  <div class="scan-workspace">
    <header class="scan-page-heading"><div><p class="scan-eyebrow">Good for your pocket. Better for the planet.</p><h1>Find its next home<span>.</span></h1><p>Compare real recycler offers and take the next step toward pickup.</p></div><span class="scan-heading-chip"><ScanIcon name="pin" :size="16" tone="brand" /> Recycler matching</span></header>
    <ScanSteps :current="3" :item-id="id" />
    <div v-if="pending" class="scan-loading-layout" role="status" aria-label="Finding recycler offers"><div class="scan-loading-photo" /><div class="scan-panel"><LoadingSkeleton :lines="6" label="Finding eligible recyclers" /></div></div>
    <section v-else-if="itemError || !item" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="image" :size="28" tone="brand" /></span><h2>We couldn’t load this item.</h2><p>It may be unavailable or belong to another account. Try again or start with a new photo.</p><div class="scan-inline-actions"><BaseButton @click="refreshItem()">Try again</BaseButton><BaseButton to="/scan" variant="ghost">Back to scanner</BaseButton></div></section>
    <section v-else-if="!item.weightKg" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="scale" :size="28" tone="brand" /></span><h2>A little detail makes a difference.</h2><p>Add your item’s weight so recyclers can give you a meaningful offer.</p><BaseButton :to="`/scan/${id}/analysis`">Add item weight<ScanIcon name="arrow" :size="17" /></BaseButton></section>
    <div v-else class="scan-matches-layout">
      <div class="scan-matches-grid">
        <aside class="scan-value-aside">
          <section class="scan-value-card" aria-labelledby="item-value"><div class="scan-value-top"><span class="scan-dark-icon"><ScanIcon name="leaf" :size="24" tone="brand" /></span><span class="scan-mini-label">YOUR ITEM’S POTENTIAL</span></div><p class="scan-value-label">Estimated value</p><h2 id="item-value"><template v-if="valueMin != null && valueMax != null">{{ formatNaira(valueMin) }}<span v-if="valueMin !== valueMax"> – {{ formatNaira(valueMax) }}</span></template><template v-else>Not available yet</template></h2><p>Based on {{ item.weightKg }} kg of {{ item.materialCode }} and published recycler prices.</p><div class="scan-value-divider" /><div class="scan-value-footer"><ScanIcon name="shield" :size="17" tone="brand" /><span>Offers from eligible recyclers</span></div></section>
          <div class="scan-item-summary"><img v-if="!imageFailed" :src="item.imageUrl" alt="Your recyclable item" @error="imageFailed = true"><span v-else class="scan-thumbnail-placeholder" role="img" aria-label="Item photo unavailable"><ScanIcon name="image" :size="24" /></span><div><strong>{{ item.itemName || item.materialCode || 'Your item' }}</strong><span>{{ item.materialCode }}<span aria-hidden="true"> · </span>{{ item.weightKg }} kg</span><NuxtLink :to="`/scan/${id}/analysis`">Review item<ScanIcon name="chevron" :size="12" /></NuxtLink></div></div>
          <div v-if="!activeRequest" class="scan-matching-explanation"><h3>{{ reassigning ? 'Choose another recycler' : 'How we find your match' }}</h3><p>{{ reassigning ? 'Pick a different recycler for this pending pickup. Your current assignment stays until you confirm a new one.' : 'We consider material, distance, price and available capacity. Nearby recyclers rank higher, and you can still request farther ones.' }}</p><div><ScanIcon name="pin" :size="17" tone="brand" /><span>{{ matches.length }} eligible {{ matches.length === 1 ? 'recycler' : 'recyclers' }} found</span></div><p v-if="reassigning && currentPendingRequest" class="muted">Currently pending with {{ currentPendingRequest.businessName || 'a recycler' }}.</p><label class="scan-pickup-time" for="pickup-time"><span>Preferred pickup time <small>Optional</small></span><input id="pickup-time" v-model="pickupTime" type="datetime-local" :min="earliestPickupTime"><small>The recycler confirms availability after you request.</small></label></div>
        </aside>

        <section v-if="activeRequest && requestPanelAction" class="scan-panel scan-request-panel"><span class="scan-heading-chip"><ScanIcon name="check" :size="16" /> {{ requestPanelChip }}</span><h2>{{ activeRequest.businessName || 'Assigned recycler' }}</h2><p class="scan-request-status">{{ activeRequest.status.replaceAll('_', ' ') }}</p><div class="scan-request-payout"><span>Expected payout</span><strong>{{ formatNaira(activeRequest.expectedPayout) }}</strong></div><StatusTimeline :steps="activeRequest.timeline" /><BaseButton :to="requestPanelAction.to" class="scan-full-button">{{ requestPanelAction.label }}<ScanIcon name="arrow" :size="17" /></BaseButton></section>
        <section v-else-if="recommended" class="scan-panel scan-recommended-panel" aria-labelledby="best-match">
          <header class="scan-recycler-heading"><div><div class="scan-recycler-badges"><span class="scan-recommended-label"><ScanIcon name="sparkles" :size="14" tone="brand" /> YOUR BEST MATCH</span><span v-if="recommended.withinServiceRadius === false" class="scan-outside-area-badge">Outside usual area</span></div><h2 id="best-match">{{ recommended.businessName }}</h2><p><ScanIcon name="pin" :size="15" tone="brand" />{{ distanceLabel(recommended.distanceKm) }}</p></div><span class="scan-recycler-symbol"><ScanIcon name="building" :size="27" tone="brand" /></span></header>
          <div class="scan-offer-row"><div><span>Expected payout</span><strong>{{ formatNaira(recommended.expectedPayout) }}</strong></div><div><span>Price per kg</span><strong>{{ formatNaira(recommended.pricePerKg) }}<small> / kg</small></strong></div></div>
          <div class="scan-recycler-metrics"><div><span>Match score</span><strong>{{ recommended.matchScore }}<small> / 100</small></strong></div><div><span>Available capacity</span><strong>{{ recommended.remainingCapacityKg.toLocaleString('en-NG') }}<small> kg</small></strong></div></div>
          <div class="scan-match-reasons"><h3>A good fit for your item</h3><ul><li v-for="reason in recommended.whySelected" :key="reason"><ScanIcon name="check" :size="15" /><span>{{ reason }}</span></li></ul><details v-if="recommended.reasons.length" class="scan-match-detail"><summary>See matching details<ScanIcon name="chevron" :size="13" /></summary><ul><li v-for="reason in recommended.reasons" :key="reason">{{ reason }}</li></ul></details></div>
          <BaseButton class="scan-full-button" :loading="requestingId === recommended.recyclerId" :disabled="!!requestingId || isCurrentRecycler(recommended.recyclerId)" @click="beginRequest(recommended)">{{ isCurrentRecycler(recommended.recyclerId) ? 'Current recycler' : reassigning ? 'Change to this recycler' : 'Review pickup request' }}<ScanIcon v-if="!requestingId && !isCurrentRecycler(recommended.recyclerId)" name="arrow" :size="17" /></BaseButton>
          <button v-if="matches.length > 1" type="button" class="scan-compare-toggle" :aria-expanded="comparing" aria-controls="recycler-comparison" @click="comparing = !comparing">{{ comparing ? 'Hide comparison' : `Compare ${matches.length} recyclers` }}<ScanIcon name="chevron" :size="14" :class="{ 'is-open': comparing }" /></button>
        </section>
        <section v-else-if="!pastMatching(item.status) || reassigning" class="scan-panel scan-empty-panel scan-no-match"><span class="scan-empty-icon"><ScanIcon :name="matchError ? 'refresh' : 'pin'" :size="28" tone="brand" /></span><p class="scan-mini-label">{{ matchError ? 'TEMPORARY MATCHING ISSUE' : 'NO CURRENT MATCH' }}</p><h2>{{ matchError ? 'The search hit a snag.' : 'No recycler is ready for this item yet.' }}</h2><p>{{ matchError ? 'We couldn’t load recycler offers right now. Your item is still saved, so you can retry without starting again.' : 'No recycler currently accepts this material with enough capacity and a published price. Your item is saved while availability changes.' }}</p><div class="scan-recovery-list"><span><ScanIcon name="check" :size="15" /> Try again when a recycler updates availability</span><span><ScanIcon name="check" :size="15" /> Review the material, weight, or pickup point</span><span><ScanIcon name="check" :size="15" /> Keep this item saved and scan another one</span></div><div class="scan-inline-actions"><BaseButton @click="refreshMatch()"><ScanIcon name="refresh" :size="17" />Try matching again</BaseButton><BaseButton :to="`/scan/${id}/analysis`" variant="ghost">Review item details</BaseButton><BaseButton to="/scan" variant="ghost">Scan another item</BaseButton></div></section>
        <section v-else class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="check" :size="28" /></span><h2>Your item is on its way.</h2><p>Continue to your dashboard to follow its pickup progress.</p><BaseButton to="/dashboard/user">View my requests<ScanIcon name="arrow" :size="17" /></BaseButton></section>
      </div>

      <section v-if="comparing && matches.length && !activeRequest" id="recycler-comparison" class="scan-comparison-section" aria-labelledby="comparison-heading"><header><div><p class="scan-eyebrow">Your options, side by side</p><h2 id="comparison-heading">Choose the right fit.</h2></div><span>{{ matches.length }} eligible recyclers</span></header><div class="scan-comparison-grid"><article v-for="(row, index) in matches" :key="row.recyclerId" class="scan-comparison-card" :class="{ 'is-recommended': row.recyclerId === recommended?.recyclerId }"><div class="scan-comparison-rank"><span v-if="row.recyclerId === recommended?.recyclerId"><ScanIcon name="sparkles" :size="13" /> Recommended</span><span v-else-if="isCurrentRecycler(row.recyclerId)">Current</span><span v-else>Option {{ index + 1 }}</span><strong>{{ row.matchScore }}<small> / 100</small></strong></div><h3>{{ row.businessName }}</h3><p class="scan-comparison-distance"><ScanIcon name="pin" :size="14" />{{ distanceLabel(row.distanceKm) }}</p><p v-if="row.withinServiceRadius === false" class="scan-outside-area-note">Outside usual area</p><div class="scan-comparison-payout"><span>Expected payout</span><strong>{{ formatNaira(row.expectedPayout) }}</strong><small>{{ formatNaira(row.pricePerKg) }} per kg</small></div><ul><li v-for="reason in row.reasons" :key="reason">{{ reason }}</li></ul><BaseButton size="sm" :variant="row.recyclerId === recommended?.recyclerId ? 'primary' : 'ghost'" :loading="requestingId === row.recyclerId" :disabled="!!requestingId || isCurrentRecycler(row.recyclerId)" @click="beginRequest(row)">{{ isCurrentRecycler(row.recyclerId) ? 'Current recycler' : reassigning ? 'Change to this recycler' : 'Review request' }}<ScanIcon v-if="!requestingId && !isCurrentRecycler(row.recyclerId)" name="arrow" :size="15" /></BaseButton></article></div></section>
      <p v-if="actionError" class="scan-alert scan-alert--error" role="alert">{{ actionError }}</p>
      <footer class="scan-flow-footer"><BaseButton :to="`/scan/${id}/analysis`" variant="ghost" size="sm"><ScanIcon name="arrow" :size="16" class="scan-back-arrow" />Back to analysis</BaseButton><BaseButton to="/scan" variant="ghost" size="sm"><ScanIcon name="camera" :size="17" />Scan another item</BaseButton></footer>
    </div>
    <BaseModal :open="confirming" title="Confirm pickup request" @update:open="confirming = $event">
      <div v-if="selectedRecycler" class="scan-confirmation"><p>{{ reassigning ? 'Confirm the new recycler for this pending pickup.' : 'Review the details before sending your pickup request.' }}</p><dl><div><dt>Item</dt><dd>{{ item?.itemName || item?.materialCode || 'Recyclable item' }} · {{ item?.weightKg }} kg</dd></div><div><dt>Recycler</dt><dd>{{ selectedRecycler.businessName }} · {{ distanceLabel(selectedRecycler.distanceKm) }}</dd></div><div><dt>Expected payout</dt><dd>{{ formatNaira(selectedRecycler.expectedPayout) }}</dd></div><div><dt>Pickup address</dt><dd>Your saved pickup location</dd></div><div><dt>Preferred time</dt><dd>{{ pickupTime ? formatPickupTime(new Date(pickupTime).toISOString()) : 'No preference' }}</dd></div></dl><p v-if="selectedRecycler.withinServiceRadius === false" class="scan-confirmation-note scan-confirmation-note--caution">This recycler is outside their usual service area. They may take longer to accept or decline the pickup.</p><p class="scan-confirmation-note">{{ reassigning ? 'The previous recycler will be notified that this pickup was reassigned.' : 'The recycler must accept before pickup is confirmed. You can update the time or cancel while the request is pending.' }}</p></div>
      <template #footer><BaseButton variant="ghost" @click="confirming = false">Go back</BaseButton><BaseButton :loading="!!requestingId" @click="confirmRequest">{{ reassigning ? 'Confirm new recycler' : 'Send pickup request' }}</BaseButton></template>
    </BaseModal>
  </div>
</template>
