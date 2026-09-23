<script setup lang="ts">
import { formatNaira } from '~~/utils/format'
import type { PickupRequestView } from '../../types'

const props = defineProps<{
  request: PickupRequestView
  role: 'user' | 'recycler' | 'waste_operator'
}>()

const emit = defineEmits<{
  updated: [PickupRequestView]
}>()

const busy = ref(false)
const actionError = ref('')
const toast = useToast()

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
    toast.success('Request updated', `Status changed to ${status.replaceAll('_', ' ')}.`)
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

    <StatusTimeline :steps="request.timeline" />

    <div class="request-card-meta">
      <span>{{ request.distanceKm }} km</span>
      <span>NGN {{ Math.round(request.pricePerKg).toLocaleString('en-NG') }}/kg</span>
      <time v-if="request.createdAt" :datetime="request.createdAt">Requested {{ new Date(request.createdAt).toLocaleString('en-NG') }}</time>
    </div>

    <div v-if="role === 'user' && request.status === 'pending'" class="request-card-actions">
      <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('cancelled')">Cancel request</BaseButton>
    </div>
    <div v-else-if="role === 'recycler'" class="request-card-actions">
      <template v-if="request.status === 'pending'">
        <BaseButton size="sm" :loading="busy" @click="setStatus('accepted')">Accept</BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="busy" @click="setStatus('rejected')">Reject</BaseButton>
      </template>
      <BaseButton v-else-if="request.status === 'accepted'" size="sm" :loading="busy" @click="setStatus('picked_up')">Mark picked up</BaseButton>
      <BaseButton v-else-if="request.status === 'picked_up'" size="sm" :loading="busy" @click="setStatus('completed')">Mark completed</BaseButton>
    </div>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
  </article>
</template>
