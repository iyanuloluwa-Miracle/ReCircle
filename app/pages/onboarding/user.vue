<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const pickup = usePickupLocation()
const phase = ref<'location' | 'howto'>('location')
const pending = ref(false)
const errorMessage = ref('')

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
    await navigateTo('/scan')
  } catch {
    errorMessage.value = 'Could not finish onboarding. Try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Consumer setup — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit :title="phase === 'location' ? 'Where should we pick up?' : 'How scanning works.'">
    <div v-if="phase === 'location'" class="onboard-stack">
      <p class="muted auth-hint">Set a default pickup area. You can still change it for each scan.</p>
      <p class="location-status">{{ pickup.label.value }}</p>
      <div class="onboard-actions">
        <BaseButton variant="secondary" :loading="pickup.pending.value" @click="pickup.useDeviceLocation()">
          Use current location
        </BaseButton>
      </div>
      <div class="auth-form">
        <label for="onboard-lat">Latitude</label>
        <input id="onboard-lat" v-model="pickup.latitude.value" inputmode="decimal" placeholder="6.45">
        <label for="onboard-lng">Longitude</label>
        <input id="onboard-lng" v-model="pickup.longitude.value" inputmode="decimal" placeholder="3.39">
        <BaseButton variant="ghost" type="button" @click="pickup.useManualLocation()">Use these coordinates</BaseButton>
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
      <BaseButton :loading="pending" :disabled="pending" @click="finish">Scan your first item</BaseButton>
    </div>
  </AuthSplit>
</template>
