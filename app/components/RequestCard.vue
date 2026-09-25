<script setup lang="ts">
import { formatNaira, formatPickupTime } from '~~/utils/format'
import type { PickupRequestView } from '../../types'

const props = defineProps<{
  request: PickupRequestView
  role: 'user' | 'recycler' | 'admin'
  /** History lists collapse the timeline so pagination stays short. */
  compact?: boolean
}>()

const emit = defineEmits<{
  updated: [PickupRequestView]
}>()

const busy = ref(false)
const actionError = ref('')
const toast = useToast()
const rescheduling = ref(false)
const pickupTime = ref('')

function localDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function earliestPickupTime() { return localDateTime(new Date(Date.now() + 30 * 60 * 1000).toISOString()) }

async function reschedule() {
  if (!pickupTime.value) return
  busy.value = true
  actionError.value = ''
  try {
    const updated = await $fetch<PickupRequestView>(`/api/requests/${props.request.id}/schedule`, { method: 'PATCH', body: { requestedPickupTime: new Date(pickupTime.value).toISOString() } })
    emit('updated', updated)
    rescheduling.value = false
    toast.success('Pickup time updated', 'Your recycler will review the new preferred time.')
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not update the pickup time.')
    toast.error('Could not update pickup time', actionError.value)
  } finally { busy.value = false }
}

function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const response = error.data as { statusMessage?: string }
    if (response?.statusMessage) return response.statusMessage
  }
  return fallback
}

async function setStatus(status: string) {
  busy.value = true
  actionError.value = ''
  try {
    const updated = await $fetch<PickupRequestView>(`/api/requests/${props.request.id}/status`, {
      method: 'PATCH',
      body: { status }
    })
    emit('updated', updated)
    toast.success(
      status === 'completed' ? 'Collection confirmed' : 'Request updated',
      status === 'completed'
        ? 'Payout has been released to the consumer wallet / Paystack.'
        : `Status changed to ${status.replaceAll('_', ' ')}.`
    )
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not update this request.')
    toast.error('Could not update request', actionError.value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="request-card">
    <header class="request-card-head">
      <div>
        <p class="analysis-kicker">{{ request.businessName || 'Recycler' }}</p>
        <h3>{{ request.itemName || request.materialCode || 'Waste item' }}</h3>
        <p class="muted">
          {{ request.weightKg ?? '—' }} kg
          · {{ formatNaira(request.expectedPayout) }}
          · score {{ request.matchScore }}/100
        </p>
      </div>
      <BaseBadge :tone="request.status === 'completed' ? 'green' : request.status === 'rejected' || request.status === 'cancelled' ? 'warning' : 'lime'">
        {{ request.status.replaceAll('_', ' ').toUpperCase() }}
      </BaseBadge>
    </header>

    <details v-if="compact" class="request-timeline-details">
      <summary>Status history</summary>
      <StatusTimeline :steps="request.timeline" />
    </details>
    <StatusTimeline v-else :steps="request.timeline" />

    <div class="request-card-meta">
      <span>{{ request.distanceKm }} km</span>
      <span>NGN {{ Math.round(request.pricePerKg).toLocaleString('en-NG') }}/kg</span>
      <span v-if="request.requestedPickupTime">Preferred pickup: {{ formatPickupTime(request.requestedPickupTime) }}</span>
      <span v-if="request.confirmedPickupTime">Confirmed pickup: {{ formatPickupTime(request.confirmedPickupTime) }}</span>
      <time v-if="request.createdAt" :datetime="request.createdAt">Requested {{ new Date(request.createdAt).toLocaleString('en-NG') }}</time>
    </div>

    <div v-if="role === 'user' && request.status === 'pending'" class="request-card-actions">
      <BaseButton size="sm" variant="ghost" :disabled="busy" @click="rescheduling = !rescheduling; pickupTime = localDateTime(request.requestedPickupTime)">{{ rescheduling ? 'Close schedule' : 'Change time' }}</BaseButton>
      <BaseButton size="sm" variant="ghost" :to="`/scan/${request.wasteItemId}/match?reassign=1`">Change recycler</BaseButton>
      <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('cancelled')">Cancel request</BaseButton>
    </div>
    <form v-if="role === 'user' && request.status === 'pending' && rescheduling" class="request-reschedule" @submit.prevent="reschedule"><label :for="`pickup-time-${request.id}`">New preferred pickup time<input :id="`pickup-time-${request.id}`" v-model="pickupTime" type="datetime-local" :min="earliestPickupTime()" required></label><BaseButton size="sm" :loading="busy" type="submit">Save time</BaseButton></form>
    <div v-if="role === 'user' && ['accepted', 'picked_up'].includes(request.status)" class="pickup-tracking" aria-label="Pickup tracking details">
      <strong>{{ request.status === 'picked_up' ? 'Collected — awaiting payment' : 'Pickup confirmed' }}</strong>
      <span v-if="request.confirmedPickupTime">Expected arrival: {{ formatPickupTime(request.confirmedPickupTime) }}</span>
      <span v-else>Awaiting a confirmed arrival time.</span>
      <a v-if="request.recyclerPhone" :href="`tel:${request.recyclerPhone}`">Call recycler: {{ request.recyclerPhone }}</a>
      <span v-else>Recycler contact will appear when they add it.</span>
    </div>
    <div v-else-if="role === 'recycler'" class="request-card-actions">
      <template v-if="request.status === 'pending'">
        <BaseButton size="sm" :loading="busy" @click="setStatus('accepted')">Accept</BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('rejected')">Reject</BaseButton>
      </template>
      <BaseButton v-else-if="request.status === 'accepted'" size="sm" :loading="busy" @click="setStatus('completed')">Confirm collected &amp; release payout</BaseButton>
      <BaseButton v-else-if="request.status === 'picked_up'" size="sm" :loading="busy" @click="setStatus('completed')">Release payout</BaseButton>
    </div>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
  </article>
</template>
