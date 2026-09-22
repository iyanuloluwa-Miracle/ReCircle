<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../types'

const props = defineProps<{
  request: PickupRequestView
}>()

const emit = defineEmits<{
  updated: [PickupRequestView]
}>()

const busy = ref(false)
const actionError = ref('')

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
      body: { status }
    })
    emit('updated', updated)
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not update this request.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="incoming-card">
    <img
      v-if="request.imageUrl"
      class="incoming-card-photo"
      :src="request.imageUrl"
      :alt="request.itemName || request.materialCode || 'Waste item'"
    >
    <div v-else class="incoming-card-photo incoming-card-photo--empty" aria-hidden="true">No photo</div>
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
      </dl>
      <div class="incoming-card-actions">
        <BaseButton size="sm" :loading="busy" @click="setStatus('accepted')">Accept</BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('rejected')">Reject</BaseButton>
      </div>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </div>
  </article>
</template>
