<script setup lang="ts">
import { materialCodes, recyclabilityValues } from '~~/utils/classification'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Waste analysis — ReCircle', robots: 'noindex' })

interface AnalysisItem {
  id: string
  imageUrl: string
  status: string
  locationSource: string | null
  itemName: string | null
  materialCode: string | null
  recyclability: string | null
  confidence: number | null
  disposalMethod: string | null
  preparationInstructions: string[]
  hazardWarning: string | null
  weightKg: number | null
  classificationSource: 'ai' | 'manual' | null
}

const imageFailed = ref(false)
const id = String(useRoute().params.id)
const { data, pending, error, refresh } = await useAsyncData(`waste-analysis-${id}`, async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<AnalysisItem>(`/api/waste-items/${id}`)
})
const analyzing = ref(false)
const savingCorrection = ref(false)
const savingWeight = ref(false)
const matching = ref(false)
const actionError = ref('')
const editing = ref(false)
const selectedMaterial = ref('UNKNOWN')
const selectedRecyclability = ref('conditionally_recyclable')
const weightInput = ref('')

watch(data, item => {
  if (!item) return
  selectedMaterial.value = item.materialCode ?? 'UNKNOWN'
  selectedRecyclability.value = item.recyclability ?? 'conditionally_recyclable'
  weightInput.value = item.weightKg == null ? '' : String(item.weightKg)
}, { immediate: true })

const needsConfirmation = computed(() => data.value?.confidence != null
  && data.value.confidence < 0.65 && data.value.classificationSource !== 'manual')

function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const response = error.data as { statusMessage?: string }
    if (response?.statusMessage) return response.statusMessage
  }
  return fallback
}

async function analyze() {
  if (analyzing.value) return
  actionError.value = ''
  analyzing.value = true
  try {
    await $fetch('/api/analyze-waste', { method: 'POST', body: { wasteItemId: id } })
    await refresh()
  } catch (error) {
    actionError.value = friendlyError(error, 'Analysis failed. Please try again.')
  } finally { analyzing.value = false }
}

async function saveCorrection() {
  actionError.value = ''
  savingCorrection.value = true
  try {
    await $fetch(`/api/waste-items/${id}/analysis`, { method: 'PATCH', body: {
      materialCode: selectedMaterial.value, recyclability: selectedRecyclability.value
    } })
    await refresh()
    editing.value = false
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not save your correction. Please try again.')
  } finally { savingCorrection.value = false }
}

async function saveWeight() {
  actionError.value = ''
  const weightKg = Number(weightInput.value)
  if (!weightInput.value.trim() || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100000) {
    actionError.value = 'Enter a weight greater than 0 kg.'
    return
  }
  savingWeight.value = true
  try {
    await $fetch(`/api/waste-items/${id}/analysis`, { method: 'PATCH', body: { weightKg } })
    await refresh()
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not save the weight. Please try again.')
  } finally { savingWeight.value = false }
}

async function findMatches() {
  actionError.value = ''
  const weightKg = Number(weightInput.value || data.value?.weightKg)
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100000) {
    actionError.value = 'Enter a weight greater than 0 kg.'
    return
  }
  matching.value = true
  try {
    await $fetch('/api/match-recycler', { method: 'POST', body: { wasteItemId: id, weightKg } })
    await navigateTo(`/scan/${id}/match`)
  } catch (error) {
    actionError.value = friendlyError(error, 'Could not match recyclers. Please try again.')
  } finally { matching.value = false }
}

function label(value: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()) : '—'
}
</script>
<template>
  <div class="scan-workspace">
    <header class="scan-page-heading"><div><p class="scan-eyebrow">A closer look at your material</p><h1>Meet your recyclable<span>.</span></h1><p>Review the material, add its weight, and discover its next destination.</p></div><span class="scan-heading-chip"><ScanIcon name="sparkles" :size="16" /> Material analysis</span></header>
    <ScanSteps :current="2" :item-id="id" />
    <div v-if="pending" class="scan-loading-layout" role="status" aria-label="Loading your item"><div class="scan-loading-photo" /><div class="scan-panel"><LoadingSkeleton :lines="6" label="Loading material analysis" /></div></div>
    <section v-else-if="error || !data" class="scan-panel scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="image" :size="28" /></span><h2>We couldn’t load this item.</h2><p>It may be unavailable or belong to another account. Try again or start with a new photo.</p><div class="scan-inline-actions"><BaseButton @click="refresh()"><ScanIcon name="refresh" :size="17" />Try again</BaseButton><BaseButton to="/scan" variant="ghost">Back to scanner</BaseButton></div></section>
    <div v-else class="scan-analysis-grid">
      <aside class="scan-item-aside">
        <figure class="scan-item-image" :class="{ 'is-analyzing': analyzing }"><img v-if="!imageFailed" :src="data.imageUrl" alt="Your uploaded item for material analysis" @error="imageFailed = true"><div v-else class="scan-image-unavailable" role="img" aria-label="Item photo unavailable"><ScanIcon name="image" :size="32" /><span>Your item photo is unavailable</span></div><figcaption><ScanIcon :name="data.status === 'draft' ? 'image' : 'check'" :size="15" />{{ analyzing ? 'Analyzing your photo…' : data.status === 'draft' ? 'Your uploaded photo' : 'Material reviewed' }}</figcaption><div v-if="analyzing" class="scan-analysis-sweep" aria-hidden="true" /></figure>
        <div class="scan-image-meta"><ScanIcon name="pin" :size="18" /><div><strong>Pickup point saved</strong><p>{{ data.locationSource === 'demo' ? 'Demo pickup point · Nigeria' : data.locationSource === 'device' ? 'Current device location' : 'Manually entered location' }}</p></div></div>
        <div class="scan-analysis-note"><ScanIcon name="shield" :size="20" /><p>AI identifies visible material. You can always confirm or correct the result.</p></div>
        <BaseButton to="/scan" variant="ghost" size="sm"><ScanIcon name="camera" :size="17" />Scan another item</BaseButton>
      </aside>
      <section class="scan-panel scan-results-panel" aria-live="polite" :aria-busy="analyzing">
        <template v-if="data.status === 'draft'">
          <div class="scan-ready-analysis"><span class="scan-empty-icon"><ScanIcon name="sparkles" :size="28" /></span><span class="scan-mini-label">PHOTO READY</span><h2>Let’s see what you have.</h2><p>Your photo and pickup point are saved. We’ll identify the visible material and share how to prepare it for recycling.</p><div class="scan-analysis-expectations"><span><ScanIcon name="leaf" :size="17" /> Material identification</span><span><ScanIcon name="check" :size="17" /> Recycling guidance</span><span><ScanIcon name="shield" :size="17" /> Preparation & safety tips</span></div><BaseButton :loading="analyzing" :disabled="analyzing" @click="analyze"><ScanIcon v-if="!analyzing" name="sparkles" :size="18" />{{ analyzing ? 'Analyzing your photo…' : 'Analyze this photo' }}</BaseButton><small v-if="analyzing" role="status">This may take a moment. Your photo is being reviewed.</small></div>
        </template>
        <template v-else-if="data.itemName && data.materialCode">
          <div class="scan-result-title"><div><p class="scan-eyebrow">{{ data.classificationSource === 'manual' ? 'Confirmed by you' : 'AI identification' }}</p><h2>{{ data.itemName }}</h2></div><span class="scan-result-check"><ScanIcon name="check" :size="21" /></span></div>
          <div class="scan-material-facts"><div><span>Material type</span><strong>{{ data.materialCode }}</strong></div><div><span>Recyclability</span><strong>{{ label(data.recyclability) }}</strong></div></div>
          <div v-if="data.confidence != null" class="scan-confidence"><div><span>AI confidence <span class="scan-help" tabindex="0" role="note" aria-label="Confidence measures how certain the AI is about the visible material. It is not a guarantee." title="Confidence measures how certain the AI is about the visible material. It is not a guarantee.">i</span></span><strong>{{ Math.round(data.confidence * 100) }}%</strong></div><meter :value="data.confidence" min="0" max="1" aria-label="AI material confidence" /><small>{{ data.classificationSource === 'manual' ? 'Original AI confidence · material confirmed by you' : 'Review the result to make sure it matches your item.' }}</small></div>
          <p v-if="needsConfirmation" class="scan-alert scan-alert--warning" role="status">This result needs your review. Confirm or correct the material before continuing.</p>
          <div v-if="data.hazardWarning" class="scan-alert scan-alert--error"><strong>Handle with care</strong><p>{{ data.hazardWarning }}</p></div>
          <section v-if="data.preparationInstructions.length || data.disposalMethod" class="scan-preparation"><div class="scan-subheading"><ScanIcon name="leaf" :size="18" /><h3>Prepare it for a new beginning</h3></div><ol v-if="data.preparationInstructions.length"><li v-for="step in data.preparationInstructions" :key="step">{{ step }}</li></ol><p v-else>{{ data.disposalMethod }}</p></section>
          <BaseButton v-if="!editing" variant="ghost" size="sm" class="scan-edit-material" @click="editing = true">{{ needsConfirmation ? 'Confirm or correct material' : 'Correct material' }}<ScanIcon name="chevron" :size="14" /></BaseButton>
          <form v-else class="scan-correction-form" @submit.prevent="saveCorrection"><div class="scan-subheading"><h3>Confirm the material</h3></div><div class="scan-form-fields"><label for="material-code">Material<select id="material-code" v-model="selectedMaterial" :disabled="savingCorrection"><option v-for="material in materialCodes" :key="material" :value="material">{{ material }}</option></select></label><label for="recyclability">Recyclability<select id="recyclability" v-model="selectedRecyclability" :disabled="savingCorrection"><option v-for="value in recyclabilityValues" :key="value" :value="value">{{ label(value) }}</option></select></label></div><div class="scan-inline-actions"><BaseButton type="submit" size="sm" :loading="savingCorrection">Save confirmation</BaseButton><BaseButton variant="ghost" size="sm" :disabled="savingCorrection" @click="editing = false">Cancel</BaseButton></div></form>
          <form v-if="!needsConfirmation" class="scan-weight-form" @submit.prevent="saveWeight"><div class="scan-subheading"><ScanIcon name="scale" :size="19" /><h3>Add the weight</h3></div><p>An approximate weight helps recyclers value your item.</p><label for="weight-kg" class="sr-only">Item weight in kilograms</label><div class="scan-weight-controls"><div class="scan-weight-input"><input id="weight-kg" v-model="weightInput" type="number" min="0.001" max="100000" step="any" inputmode="decimal" placeholder="e.g. 1.5" required :disabled="savingWeight || matching"><span>kg</span></div><BaseButton type="submit" size="sm" :loading="savingWeight" :disabled="matching">{{ data.weightKg == null ? 'Save weight' : 'Update weight' }}</BaseButton></div><p v-if="data.weightKg != null" class="scan-saved-weight"><ScanIcon name="check" :size="14" />{{ data.weightKg }} kg saved</p></form>
          <div v-if="!needsConfirmation && data.weightKg != null" class="scan-match-next"><BaseButton class="scan-full-button" :loading="matching" :disabled="matching || savingWeight || savingCorrection" @click="findMatches">{{ matching ? 'Finding nearby recyclers…' : 'See value & nearby recyclers' }}<ScanIcon v-if="!matching" name="arrow" :size="18" /></BaseButton><p>Valuations use current prices from eligible recyclers.</p></div>
        </template>
        <div v-else class="scan-empty-panel"><span class="scan-empty-icon"><ScanIcon name="leaf" :size="28" /></span><h2>This item has moved on.</h2><p>It is no longer available for analysis.</p><BaseButton to="/scan">Scan another item</BaseButton></div>
        <p v-if="actionError" class="scan-alert scan-alert--error" role="alert">{{ actionError }}</p>
        <BaseButton v-if="data.status === 'matched'" :to="`/scan/${id}/match`" variant="ghost" size="sm" class="scan-existing-valuation">View existing valuation<ScanIcon name="arrow" :size="16" /></BaseButton>
      </section>
    </div>
  </div>
</template>
