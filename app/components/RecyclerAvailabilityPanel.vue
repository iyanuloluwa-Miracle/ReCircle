<script setup lang="ts">
import { normalizeOperatingHours } from '~~/utils/recycler-hours'
const props = defineProps<{ profile: { availability: 'available' | 'busy' | 'offline'; businessHours: string; operatingHours: Array<{ day: number; open: string; close: string; enabled: boolean }>; contactPhone: string | null; serviceRadiusKm: number; capacityKgPerDay: number; acceptedMaterials: string[]; pricingRules: Array<{ material: string; pricePerKg: number; currency: 'NGN' }> } }>()
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()
const saving = ref(false)
const error = ref('')
const availability = ref(props.profile.availability)
const businessHours = ref(props.profile.businessHours)
const operatingHours = ref(normalizeOperatingHours(props.profile.operatingHours))
const contactPhone = ref(props.profile.contactPhone ?? '')
const serviceRadiusKm = ref(props.profile.serviceRadiusKm)
const capacityKgPerDay = ref(props.profile.capacityKgPerDay)
const materials = ref([...props.profile.acceptedMaterials])
const prices = ref(Object.fromEntries(props.profile.pricingRules.map(rule => [rule.material, rule.pricePerKg])))
const materialOptions = ['pet', 'hdpe', 'ldpe', 'pp', 'aluminium', 'steel', 'glass', 'cardboard', 'paper', 'ewaste']
function toggleMaterial(material: string) { if (materials.value.includes(material)) { if (materials.value.length > 1) materials.value = materials.value.filter(item => item !== material) } else { materials.value = [...materials.value, material]; prices.value[material] = prices.value[material] ?? 0 } }
watch(() => props.profile, profile => { availability.value = profile.availability; businessHours.value = profile.businessHours; operatingHours.value = normalizeOperatingHours(profile.operatingHours); contactPhone.value = profile.contactPhone ?? ''; serviceRadiusKm.value = profile.serviceRadiusKm; capacityKgPerDay.value = profile.capacityKgPerDay; materials.value = [...profile.acceptedMaterials]; prices.value = Object.fromEntries(profile.pricingRules.map(rule => [rule.material, rule.pricePerKg])) }, { deep: true })
async function save() {
  saving.value = true; error.value = ''
  try {
    await $fetch('/api/recycler/profile', { method: 'PATCH', body: { availability: availability.value, businessHours: businessHours.value, operatingHours: operatingHours.value, contactPhone: contactPhone.value.trim() || null, serviceRadiusKm: Number(serviceRadiusKm.value), capacityKgPerDay: Number(capacityKgPerDay.value), acceptedMaterials: materials.value, pricingRules: materials.value.map(material => ({ material, pricePerKg: Number(prices.value[material]), currency: 'NGN' })) } })
    toast.success('Availability updated', 'Matching now reflects your latest settings.')
    emit('saved')
  } catch (cause) { error.value = cause && typeof cause === 'object' && 'data' in cause ? ((cause.data as { statusMessage?: string }).statusMessage || 'Could not update availability.') : 'Could not update availability.'; toast.error('Could not update availability', error.value) }
  finally { saving.value = false }
}
</script>
<template>
  <form class="recycler-availability" @submit.prevent="save">
    <label>Status<select v-model="availability"><option value="available">Available for new pickups</option><option value="busy">Busy — pause new matching</option><option value="offline">Offline</option></select></label>
    <label>Opening hours<input v-model="businessHours" maxlength="160" placeholder="Mon–Sat, 9:00 AM–5:00 PM"></label>
    <fieldset class="recycler-hours"><legend>Hours used for matching (WAT)</legend><div v-for="day in operatingHours" :key="day.day"><label><input v-model="day.enabled" type="checkbox"> {{ ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.day] }}</label><input v-model="day.open" type="time" :disabled="!day.enabled"><span>to</span><input v-model="day.close" type="time" :disabled="!day.enabled"></div></fieldset>
    <label>Pickup contact phone<input v-model="contactPhone" type="tel" maxlength="40" placeholder="+234 800 000 0000"></label>
    <div><label>Service radius (km)<input v-model.number="serviceRadiusKm" type="number" min="1" max="100"></label><label>Daily capacity (kg)<input v-model.number="capacityKgPerDay" type="number" min="1"></label></div>
    <fieldset class="recycler-materials"><legend>Accepted materials</legend><button v-for="material in materialOptions" :key="material" type="button" :class="{ 'is-selected': materials.includes(material) }" @click="toggleMaterial(material)">{{ material.toUpperCase() }}</button></fieldset>
    <div class="recycler-price-list"><label v-for="material in materials" :key="material">{{ material.toUpperCase() }} (NGN/kg)<input v-model.number="prices[material]" type="number" min="0"></label></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p><BaseButton type="submit" size="sm" :loading="saving">Save availability</BaseButton>
  </form>
</template>
