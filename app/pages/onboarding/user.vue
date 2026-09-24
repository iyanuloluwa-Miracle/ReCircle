<script setup lang="ts">
import { onboardingStepsForRole } from '../../../utils/onboarding'

definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const pickup = usePickupLocation()
const phase = ref<'location' | 'howto'>('location')
const pending = ref(false)
const errorMessage = ref('')
const steps = computed(() => onboardingStepsForRole('user'))
const currentStep = computed(() => phase.value === 'location' ? 2 : 3)

async function saveLocation() {
  if (!pickup.location.value) {
    errorMessage.value = 'Choose a pickup location to continue.'
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ user: typeof auth.user.value }>('/api/profile/location', {
      method: 'PATCH',
      body: { location: pickup.location.value }
    })
    auth.user.value = result.user
    phase.value = 'howto'
  } catch {
    errorMessage.value = 'Could not save your location. Try again.'
  } finally {
    pending.value = false
  }
}

async function finish() {
  pending.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ user: typeof auth.user.value }>('/api/onboarding/complete', { method: 'POST' })
    auth.user.value = result.user
    await navigateTo('/dashboard/user')
  } catch {
    errorMessage.value = 'Could not finish onboarding. Try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Consumer setup — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit
    :title="phase === 'location' ? 'Where should we pick up?' : 'How scanning works.'"
    :steps="steps"
    :current-step="currentStep"
  >
    <div v-if="phase === 'location'" class="onboard-stack">
      <p class="muted auth-hint">Set a default pickup area. You can still change it for each scan.</p>
      <p class="location-status">{{ pickup.label.value }}</p>
      <div class="onboard-actions">
        <BaseButton variant="secondary" :loading="pickup.pending.value" @click="pickup.useDeviceLocation()">
          Use current location
        </BaseButton>
      </div>
      <div class="auth-form">
        <label for="onboard-address">Address</label>
        <input
          id="onboard-address"
          v-model="pickup.address.value"
          type="text"
          autocomplete="street-address"
          placeholder="12 Admiralty Way, Lekki, Lagos"
        >
        <BaseButton
          variant="ghost"
          type="button"
          :loading="pickup.pending.value"
          :disabled="pickup.pending.value"
          @click="pickup.useAddressLocation()"
        >
          Use this address
        </BaseButton>
      </div>
      <p v-if="pickup.error.value || errorMessage" class="form-error" role="alert">
        {{ pickup.error.value || errorMessage }}
      </p>
      <BaseButton :loading="pending" :disabled="pending || !pickup.location.value" @click="saveLocation">
        Continue
      </BaseButton>
    </div>

    <div v-else class="onboard-stack">
      <ol class="howto-list">
        <li>Photograph the recyclable.</li>
        <li>Confirm material and weight.</li>
        <li>Match a nearby recycler and request pickup.</li>
        <li>Track the job and earn rewards.</li>
      </ol>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton :loading="pending" :disabled="pending" @click="finish">Go to dashboard</BaseButton>
    </div>
  </AuthSplit>
</template>
