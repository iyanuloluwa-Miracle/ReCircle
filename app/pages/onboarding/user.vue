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

const guideSteps = [
  {
    icon: 'camera' as const,
    title: 'Photograph',
    detail: 'Snap a clear photo of one recyclable.'
  },
  {
    icon: 'scale' as const,
    title: 'Confirm',
    detail: 'Review the material and add its weight.'
  },
  {
    icon: 'pin' as const,
    title: 'Match',
    detail: 'See nearby recycler offers and request pickup.'
  },
  {
    icon: 'leaf' as const,
    title: 'Earn',
    detail: 'Track the job and collect your rewards.'
  }
]

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

    <div v-else class="onboard-stack onboard-stack--guide">
      <p class="muted auth-hint auth-hint--center">Four moves from photo to pickup.</p>
      <ol class="onboard-guide" aria-label="How scanning works">
        <li
          v-for="(guide, index) in guideSteps"
          :key="guide.title"
          class="onboard-guide-step"
          :class="{ 'is-last': index === guideSteps.length - 1 }"
          :style="{ '--guide-index': index }"
        >
          <span class="onboard-guide-rail" aria-hidden="true" />
          <span class="onboard-guide-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="onboard-guide-icon">
            <ScanIcon :name="guide.icon" :size="18" />
          </span>
          <div class="onboard-guide-copy">
            <strong>{{ guide.title }}</strong>
            <p>{{ guide.detail }}</p>
          </div>
        </li>
      </ol>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton :loading="pending" :disabled="pending" @click="finish">Go to dashboard</BaseButton>
    </div>
  </AuthSplit>
</template>
