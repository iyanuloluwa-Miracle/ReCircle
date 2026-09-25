<script setup lang="ts">
import { formatNaira, formatNumber, formatPickupTime } from '~~/utils/format'
import type { PickupRequestView } from '../../types'

const props = defineProps<{
  request: PickupRequestView
}>()

const emit = defineEmits<{
  updated: [PickupRequestView]
}>()

const busy = ref(false)
const actionError = ref('')
const toast = useToast()
const confirmedTime = ref('')

function localDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function earliestPickupTime() { return localDateTime(new Date(Date.now() + 30 * 60 * 1000).toISOString()) }

function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const response = error.data as { statusMessage?: string }
    if (response?.statusMessage) return response.statusMessage
  }
  return fallback
}

async function setStatus(status: 'accepted' | 'rejected') {
  busy.value = true
  actionError.value = ''
  try {
    const updated = await $fetch<PickupRequestView>(`/api/requests/${props.request.id}/status`, {
      method: 'PATCH',
      body: { status, ...(status === 'accepted' && confirmedTime.value ? { confirmedPickupTime: new Date(confirmedTime.value).toISOString() } : {}) }
    })
    emit('updated', updated)
    toast.success(status === 'accepted' ? 'Pickup accepted' : 'Pickup declined', 'The requester will see the updated status.')
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not update this request.')
    toast.error('Could not update request', actionError.value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="incoming-card">
    <WasteThumb
      class="incoming-card-photo"
      :src="request.imageUrl"
      :alt="request.itemName || request.materialCode || 'Waste item'"
    />
    <div class="incoming-card-body">
      <div class="incoming-card-top">
        <BaseBadge tone="lime">INCOMING</BaseBadge>
        <strong>{{ request.materialCode || 'Material' }}</strong>
      </div>
      <h3>{{ request.itemName || 'Matched waste item' }}</h3>
      <dl class="incoming-card-facts">
        <div><dt>Weight</dt><dd>{{ request.weightKg == null ? '—' : `${formatNumber(request.weightKg)} kg` }}</dd></div>
        <div><dt>Distance</dt><dd>{{ formatNumber(request.distanceKm) }} km</dd></div>
        <div><dt>Purchase price</dt><dd>{{ formatNaira(request.expectedPayout) }}</dd></div>
        <div><dt>Pickup area</dt><dd>{{ request.pickupArea || '—' }}</dd></div>
        <div v-if="request.requestedPickupTime"><dt>Preferred time</dt><dd>{{ formatPickupTime(request.requestedPickupTime) }}</dd></div>
      </dl>
      <div class="incoming-card-actions">
        <BaseButton size="sm" :loading="busy" @click="setStatus('accepted')">Accept</BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('rejected')">Reject</BaseButton>
      </div>
      <label class="incoming-card-schedule">Confirm pickup time (optional)<input v-model="confirmedTime" type="datetime-local" :min="earliestPickupTime()" :placeholder="localDateTime(request.requestedPickupTime)"></label>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </div>
  </article>
</template>
