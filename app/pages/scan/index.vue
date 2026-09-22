<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Scan waste — ReCircle', robots: 'noindex' })

const upload = useWasteUpload()
const pickup = usePickupLocation()
const picker = ref<HTMLInputElement | null>(null)
const camera = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const nextFile = input.files?.[0]
  if (nextFile) await upload.selectFile(nextFile)
  input.value = ''
}

async function drop(event: DragEvent) {
  dragging.value = false
  const nextFile = event.dataTransfer?.files?.[0]
  if (nextFile) await upload.selectFile(nextFile)
}

async function saveDraft() {
  if (!pickup.location.value || !pickup.source.value) {
    pickup.error.value = 'Choose a pickup location before continuing.'
    return
  }
  const id = await upload.submit(pickup.location.value, pickup.source.value)
  if (id) await navigateTo(`/scan/${id}/analysis`)
}
</script>

<template>
  <div class="scanner-page">
    <p class="eyebrow">01 / Capture your material</p>
    <h1 class="page-title">See the value in what you have.</h1>
    <p class="muted workspace-intro">Take or choose a clear photo. We’ll save it as a draft for analysis.</p>

    <div class="scanner-grid">
      <section class="scanner-card" aria-label="Waste image upload">
        <div class="scanner-card-top"><span>RECIRCLE / SCANNER</span><BaseBadge tone="lime">PHOTO FIRST</BaseBadge></div>
        <div
          class="scanner-dropzone" :class="{ 'is-dragging': dragging, 'has-preview': upload.previewUrl.value }"
          @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false" @drop.prevent="drop"
        >
          <img v-if="upload.previewUrl.value" :src="upload.previewUrl.value" alt="Preview of selected recyclable item" class="scanner-preview">
          <div v-else class="scanner-empty">
            <div class="scanner-reticle" aria-hidden="true"><span>◌</span></div>
            <p class="scanner-empty-title">Place your recyclable in focus.</p>
            <p>Drag an image here or choose one below.</p>
          </div>
          <span v-if="upload.previewUrl.value" class="scanner-frame-label">READY TO UPLOAD</span>
        </div>
        <input ref="picker" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" :disabled="upload.busy.value" @change="choose">
        <input ref="camera" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" :disabled="upload.busy.value" @change="choose">
        <div class="scanner-actions">
          <BaseButton variant="secondary" :disabled="upload.busy.value" @click="picker?.click()">Choose photo</BaseButton>
          <BaseButton variant="ghost" :disabled="upload.busy.value" @click="camera?.click()">Use camera</BaseButton>
          <BaseButton v-if="upload.file.value" variant="ghost" :disabled="upload.busy.value" @click="upload.clearFile()">Remove</BaseButton>
        </div>
        <p class="scanner-file-note">JPEG, PNG or WEBP · Up to 5 MB</p>
        <p v-if="upload.file.value" class="scanner-filename">{{ upload.file.value.name }} · {{ (upload.file.value.size / 1024 / 1024).toFixed(2) }} MB</p>
        <div v-if="upload.busy.value" class="scanner-progress" role="status" aria-live="polite">
          <div class="scanner-progress-head"><span>{{ upload.stage.value === 'token' ? 'Preparing secure upload' : upload.stage.value === 'saving' ? 'Saving your draft' : 'Uploading image' }}</span><strong>{{ upload.progress.value }}%</strong></div>
          <div class="scanner-progress-track"><span :style="{ width: `${upload.progress.value}%` }" /></div>
        </div>
        <p v-if="upload.error.value" class="form-error" role="alert">{{ upload.error.value }}</p>
      </section>

      <aside class="scanner-side">
        <BaseCard tone="soft" class="scanner-location-card">
          <p class="eyebrow">02 / Pickup point</p>
          <h2>Where is this material?</h2>
          <p class="muted">We’ll use this location for the draft. Later it can help find a nearby recycler.</p>
          <div class="scanner-location-status"><span class="status-dot" />{{ pickup.label.value }}</div>
          <p v-if="pickup.source.value === 'demo'" class="scanner-demo-note">This is the seeded demo pickup point, not your live location.</p>
          <BaseButton variant="ghost" :loading="pickup.pending.value" :disabled="pickup.pending.value" @click="pickup.useDeviceLocation()">Use current location</BaseButton>
          <details class="scanner-manual">
            <summary>Enter coordinates instead</summary>
            <div class="scanner-coordinates">
              <label>Latitude<input v-model="pickup.latitude.value" type="number" step="any" min="-90" max="90" placeholder="6.4541"></label>
              <label>Longitude<input v-model="pickup.longitude.value" type="number" step="any" min="-180" max="180" placeholder="3.3947"></label>
            </div>
            <BaseButton variant="ghost" size="sm" @click="pickup.useManualLocation()">Set location</BaseButton>
          </details>
          <p v-if="pickup.error.value" class="form-error" role="alert">{{ pickup.error.value }}</p>
        </BaseCard>
        <div class="scanner-next">
          <p class="eyebrow">Next step</p>
          <p>Your image is saved as a draft before analysis. No material or price is guessed here.</p>
          <BaseButton :disabled="!upload.file.value || upload.busy.value" :loading="upload.busy.value" @click="saveDraft">{{ upload.uploadedPath.value ? 'Retry saving draft' : 'Upload and continue' }}</BaseButton>
        </div>
      </aside>
    </div>
  </div>
</template>
