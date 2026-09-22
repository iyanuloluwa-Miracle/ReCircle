<script setup lang="ts">
import type { GeoPoint } from '../../../types'

definePageMeta({ layout: 'auth', middleware: 'auth' })

const materials = [
  { code: 'pet', label: 'PET' },
  { code: 'hdpe', label: 'HDPE' },
  { code: 'ldpe', label: 'LDPE' },
  { code: 'pp', label: 'PP' },
  { code: 'aluminium', label: 'Aluminium' },
  { code: 'steel', label: 'Steel' },
  { code: 'glass', label: 'Glass' },
  { code: 'cardboard', label: 'Cardboard' },
  { code: 'paper', label: 'Paper' },
  { code: 'ewaste', label: 'E-waste' }
] as const

const step = ref(0)
const auth = useAuth()
const pickup = usePickupLocation()
const businessName = ref('')
const serviceRadiusKm = ref(15)
const capacityKgPerDay = ref(400)
const availability = ref<'available' | 'busy' | 'offline'>('available')
const selectedMaterials = ref<string[]>(['pet'])
const prices = ref<Record<string, number>>({ pet: 80 })
const pending = ref(false)
const errorMessage = ref('')

const titles = [
  'Your business.',
  'Yard location.',
  'Materials you accept.',
  'Your prices.',
  'Capacity & status.'
]

watch(selectedMaterials, (codes) => {
  for (const code of codes) {
    if (prices.value[code] === undefined) prices.value[code] = 50
  }
  for (const key of Object.keys(prices.value)) {
    if (!codes.includes(key)) delete prices.value[key]
  }
}, { deep: true })

function toggleMaterial(code: string) {
  if (selectedMaterials.value.includes(code)) {
    if (selectedMaterials.value.length === 1) return
    selectedMaterials.value = selectedMaterials.value.filter(item => item !== code)
  } else {
    selectedMaterials.value = [...selectedMaterials.value, code]
  }
}

async function submit() {
  if (!pickup.location.value) {
    errorMessage.value = 'Set your yard location.'
    step.value = 1
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const location: GeoPoint = pickup.location.value
    await $fetch('/api/recycler/profile', {
      method: 'POST',
      body: {
        businessName: businessName.value.trim(),
        location,
        serviceRadiusKm: Number(serviceRadiusKm.value),
        acceptedMaterials: selectedMaterials.value,
        pricingRules: selectedMaterials.value.map(material => ({
          material,
          pricePerKg: Number(prices.value[material] ?? 0),
          currency: 'NGN'
        })),
        capacityKgPerDay: Number(capacityKgPerDay.value),
        availability: availability.value
      }
    })
    const result = await $fetch<{ user: typeof auth.user.value }>('/api/onboarding/complete', { method: 'POST' })
    auth.user.value = result.user
    await navigateTo('/dashboard/recycler')
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    errorMessage.value = status === 409
      ? 'A recycler profile already exists for this account.'
      : 'Could not save your recycler profile. Check the fields and try again.'
  } finally {
    pending.value = false
  }
}

function next() {
  errorMessage.value = ''
  if (step.value === 0 && businessName.value.trim().length < 2) {
    errorMessage.value = 'Enter your business name.'
    return
  }
  if (step.value === 1) {
    if (!pickup.location.value) {
      errorMessage.value = 'Choose a yard location.'
      return
    }
    if (!(serviceRadiusKm.value >= 1)) {
      errorMessage.value = 'Service radius must be at least 1 km.'
      return
    }
  }
  if (step.value === 2 && selectedMaterials.value.length < 1) {
    errorMessage.value = 'Select at least one material.'
    return
  }
  if (step.value === 3) {
    const invalid = selectedMaterials.value.some(code => !(Number(prices.value[code]) >= 0))
    if (invalid) {
      errorMessage.value = 'Enter a price for every material.'
      return
    }
  }
  if (step.value >= titles.length - 1) {
    submit()
    return
  }
  step.value += 1
}

useSeoMeta({ title: 'Recycler setup — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit :title="titles[step] ?? 'Recycler setup'">
    <div class="onboard-stack">
      <p class="muted auth-hint">Step {{ step + 1 }} of {{ titles.length }}</p>

      <form v-if="step === 0" class="auth-form" @submit.prevent="next">
        <label for="biz-name">Business name*</label>
        <input id="biz-name" v-model="businessName" minlength="2" maxlength="160" required placeholder="Yaba Circular">
      </form>

      <div v-else-if="step === 1" class="onboard-stack">
        <p class="location-status">{{ pickup.label.value }}</p>
        <BaseButton variant="secondary" :loading="pickup.pending.value" @click="pickup.useDeviceLocation()">
          Use current location
        </BaseButton>
        <div class="auth-form">
          <label for="yard-lat">Latitude</label>
          <input id="yard-lat" v-model="pickup.latitude.value" inputmode="decimal">
          <label for="yard-lng">Longitude</label>
          <input id="yard-lng" v-model="pickup.longitude.value" inputmode="decimal">
          <BaseButton variant="ghost" type="button" @click="pickup.useManualLocation()">Use these coordinates</BaseButton>
          <label for="radius">Service radius (km)*</label>
          <input id="radius" v-model.number="serviceRadiusKm" type="number" min="1" max="100" required>
        </div>
        <p v-if="pickup.error.value" class="form-error">{{ pickup.error.value }}</p>
      </div>

      <div v-else-if="step === 2" class="material-grid">
        <button
          v-for="material in materials"
          :key="material.code"
          type="button"
          class="material-chip"
          :class="{ 'is-selected': selectedMaterials.includes(material.code) }"
          @click="toggleMaterial(material.code)"
        >
          {{ material.label }}
        </button>
      </div>

      <div v-else-if="step === 3" class="auth-form">
        <div v-for="code in selectedMaterials" :key="code" class="price-row">
          <label :for="`price-${code}`">{{ code.toUpperCase() }} (NGN / kg)*</label>
          <input :id="`price-${code}`" v-model.number="prices[code]" type="number" min="0" step="1" required>
        </div>
      </div>

      <div v-else class="auth-form">
        <label for="capacity">Daily capacity (kg)*</label>
        <input id="capacity" v-model.number="capacityKgPerDay" type="number" min="1" required>
        <label for="availability">Availability*</label>
        <select id="availability" v-model="availability" class="auth-select">
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton :loading="pending" :disabled="pending" @click="next">
        {{ step === titles.length - 1 ? 'Go live' : 'Continue' }}
      </BaseButton>
      <BaseButton v-if="step > 0" variant="ghost" :disabled="pending" @click="step -= 1">Back</BaseButton>
    </div>
  </AuthSplit>
</template>
