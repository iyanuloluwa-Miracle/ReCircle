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
  <div class="analysis-step">
    <p class="eyebrow">02 / Material analysis</p>
    <h1 class="page-title">Understand what you have.</h1>
    <p class="muted workspace-intro">AI helps identify visible material. You can confirm or correct the result before entering weight.</p>
    <LoadingSkeleton v-if="pending" />
    <BaseCard v-else-if="error">
      <EmptyState title="Could not load this item" description="The item may be unavailable or belong to another account.">
        <BaseButton to="/scan">Back to scanner</BaseButton>
      </EmptyState>
    </BaseCard>
    <div v-else-if="data" class="analysis-preview-card">
      <img :src="data.imageUrl" alt="Your uploaded waste item">
      <div class="analysis-preview-details">
        <BaseBadge :tone="data.status === 'draft' ? 'lime' : 'green'">{{ data.status === 'draft' ? 'READY TO ANALYZE' : data.status === 'matched' ? 'MATCHED' : 'IMAGE ANALYZED' }}</BaseBadge>
        <template v-if="data.status === 'draft'">
          <h2>Let’s identify this item.</h2>
          <p class="muted">The image and pickup location are saved. Identification may take a moment.</p>
          <BaseButton :loading="analyzing" :disabled="analyzing" class="analysis-action" @click="analyze">{{ analyzing ? 'Analyzing image…' : 'Analyze this photo' }}</BaseButton>
          <p class="analysis-location">Pickup location: {{ data.locationSource === 'demo' ? 'Demo Nigeria location' : data.locationSource === 'device' ? 'Current device location' : 'Manually entered location' }}</p>
        </template>
        <template v-else-if="data.itemName && data.materialCode">
          <p class="analysis-kicker">{{ data.classificationSource === 'manual' ? 'Confirmed by you' : 'AI identified' }}</p>
          <h2>{{ data.itemName }}</h2>
          <div class="analysis-facts">
            <div><span>Material</span><strong>{{ data.materialCode }}</strong></div>
            <div><span>Recyclability</span><strong>{{ label(data.recyclability) }}</strong></div>
            <div><span>AI confidence <span class="confidence-help" tabindex="0" role="note" aria-label="AI confidence measures how certain the model is about the visible material. It is not a guarantee." data-tooltip="AI confidence measures how certain the model is about visible material. It is not a guarantee.">?</span></span><strong>{{ Math.round((data.confidence ?? 0) * 100) }}%</strong></div>
          </div>
          <div v-if="needsConfirmation" class="analysis-caution" role="status">We're not fully confident. Please confirm the material.</div>
          <div v-if="data.hazardWarning" class="analysis-hazard"><strong>Safety note</strong><p>{{ data.hazardWarning }}</p></div>
          <div class="analysis-guidance"><strong>Before pickup</strong><ul v-if="data.preparationInstructions.length"><li v-for="step in data.preparationInstructions" :key="step">{{ step }}</li></ul><p v-else>{{ data.disposalMethod }}</p></div>
          <div v-if="!editing" class="analysis-edit-action"><BaseButton variant="ghost" size="sm" @click="editing = true">{{ needsConfirmation ? 'Confirm or correct material' : 'Correct material' }}</BaseButton></div>
          <form v-else class="analysis-form" @submit.prevent="saveCorrection">
            <label for="material-code">Material</label>
            <select id="material-code" v-model="selectedMaterial"><option v-for="material in materialCodes" :key="material" :value="material">{{ material }}</option></select>
            <label for="recyclability">Recyclability</label>
            <select id="recyclability" v-model="selectedRecyclability"><option v-for="value in recyclabilityValues" :key="value" :value="value">{{ label(value) }}</option></select>
            <div class="analysis-form-actions"><BaseButton type="submit" size="sm" :loading="savingCorrection">Save confirmation</BaseButton><BaseButton variant="ghost" size="sm" @click="editing = false">Cancel</BaseButton></div>
          </form>
          <form v-if="!needsConfirmation" class="analysis-weight" @submit.prevent="saveWeight">
            <label for="weight-kg">How much does it weigh?</label>
            <p class="muted">Enter your own approximate weight in kilograms.</p>
            <div class="analysis-weight-controls"><input id="weight-kg" v-model="weightInput" type="number" min="0.001" max="100000" step="any" inputmode="decimal" placeholder="e.g. 1.5" required><span>kg</span><BaseButton type="submit" size="sm" :loading="savingWeight">{{ data.weightKg == null ? 'Save weight' : 'Update weight' }}</BaseButton></div>
            <p v-if="data.weightKg != null" class="analysis-saved">Saved weight: {{ data.weightKg }} kg</p>
          </form>
          <div v-if="!needsConfirmation && data.weightKg != null" class="analysis-match-cta">
            <BaseButton :loading="matching" :disabled="matching" @click="findMatches">{{ matching ? 'Finding recyclers…' : 'Get valuation & matches' }}</BaseButton>
            <p class="muted">Deterministic pricing from nearby recyclers — no AI estimates.</p>
          </div>
        </template>
        <p v-else class="muted">This item is no longer available for analysis.</p>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <BaseButton v-if="data.status === 'matched'" :to="`/scan/${id}/match`" variant="ghost" size="sm">View valuation</BaseButton>
        <BaseButton to="/scan" variant="ghost" size="sm">Scan another item</BaseButton>
      </div>
    </div>
  </div>
</template>
