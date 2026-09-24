<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Scan an item — ReCircle', robots: 'noindex' })

const upload = useWasteUpload()
const pickup = usePickupLocation()
const toast = useToast()
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
    toast.error('Pickup point needed', pickup.error.value)
    return
  }
  const id = await upload.submit(pickup.location.value, pickup.source.value)
  if (id) {
    toast.success('Photo saved', 'Your item is ready for material analysis.')
    await navigateTo(`/scan/${id}/analysis`)
  } else if (upload.error.value) toast.error('Could not save your item', upload.error.value)
}

function onPlaceSelect(payload: { location: NonNullable<typeof pickup.location.value>; label: string }) {
  pickup.setPlace(payload.location, payload.label, 'manual')
}
</script>
<template>
  <div class="scan-workspace">
    <header class="scan-page-heading">
      <div><p class="scan-eyebrow">A little action. A new beginning.</p><h1>Scan an item<span>.</span></h1><p>Find out what it is, what it’s worth, and where it can go next.</p></div>
      <span class="scan-heading-chip"><ScanIcon name="sparkles" :size="16" /> AI-powered identification</span>
    </header>
    <ScanSteps :current="1" />

    <div class="scan-capture-grid">
      <section class="scan-panel scan-photo-panel" aria-labelledby="photo-heading">
        <header class="scan-panel-heading"><div class="scan-heading-with-icon"><span class="scan-icon-box"><ScanIcon name="camera" /></span><div><h2 id="photo-heading">Start with a photo</h2><p>One material at a time works best.</p></div></div><span class="scan-small-number">01</span></header>
        <div
          class="scan-dropzone" :class="{ 'is-dragging': dragging, 'has-preview': upload.previewUrl.value }"
          role="button" :tabindex="upload.busy.value ? -1 : 0" :aria-disabled="upload.busy.value" :aria-label="upload.previewUrl.value ? 'Change selected photo' : 'Choose a photo of your recyclable item'"
          @click="!upload.busy.value && picker?.click()" @keydown.enter.prevent="!upload.busy.value && picker?.click()" @keydown.space.prevent="!upload.busy.value && picker?.click()"
          @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="drop"
        >
          <template v-if="upload.previewUrl.value"><img :src="upload.previewUrl.value" alt="Preview of your selected recyclable item" class="scan-photo-preview"><span class="scan-photo-ready"><ScanIcon name="check" :size="14" /> Photo selected</span></template>
          <div v-else class="scan-upload-empty">
            <div class="scan-viewfinder" aria-hidden="true"><svg viewBox="0 0 100 112" fill="none"><path d="M38 12h24v13l7 12v53c0 7-38 7-38 0V37l7-12V12Z" fill="#d3f28a" fill-opacity=".6" stroke="#123f32" stroke-width="2.5" stroke-linejoin="round"/><path d="M38 12V6h24v6M38 25h24M31 45h38M31 76h38M42 54l-5 9h8m13 2 5-9-5-3m-6 20H42l-4-6m13-14 4-7 5 7" stroke="#123f32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <h3>Your next good move starts here.</h3><p>Drop a photo here, or choose one from your device.</p><span class="scan-file-type">JPG, PNG or WEBP <span>·</span> Up to 5 MB</span>
          </div>
        </div>
        <input ref="picker" class="sr-only" tabindex="-1" aria-label="Choose item photo" type="file" accept="image/jpeg,image/png,image/webp" :disabled="upload.busy.value" @change="choose">
        <input ref="camera" class="sr-only" tabindex="-1" aria-label="Take item photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" :disabled="upload.busy.value" @change="choose">
        <div class="scan-photo-actions"><BaseButton :disabled="upload.busy.value" @click="picker?.click()"><ScanIcon name="upload" :size="17" />{{ upload.file.value ? 'Change photo' : 'Choose photo' }}</BaseButton><BaseButton variant="ghost" class="scan-outline-button" :disabled="upload.busy.value" @click="camera?.click()"><ScanIcon name="camera" :size="18" />Use camera</BaseButton><button v-if="upload.file.value" type="button" class="scan-icon-button" aria-label="Remove selected photo" :disabled="upload.busy.value" @click="upload.clearFile()"><ScanIcon name="trash" :size="18" /></button></div>
        <div v-if="upload.file.value" class="scan-selected-file"><ScanIcon name="image" :size="17" /><span>{{ upload.file.value.name }}</span><small>{{ (upload.file.value.size / 1024 / 1024).toFixed(2) }} MB</small></div>
        <p v-if="upload.error.value" class="scan-alert scan-alert--error" role="alert">{{ upload.error.value }}</p>
        <div class="scan-photo-tips"><span><ScanIcon name="check" :size="15" /> Good lighting</span><span><ScanIcon name="check" :size="15" /> Clear background</span><span><ScanIcon name="check" :size="15" /> Item in focus</span></div>
      </section>

      <aside class="scan-side-stack">
        <section class="scan-panel scan-location-panel" aria-labelledby="pickup-heading">
          <header class="scan-heading-with-icon"><span class="scan-icon-box"><ScanIcon name="pin" /></span><div><h2 id="pickup-heading">Set a pickup point</h2><p>A nearby recycler starts here.</p></div></header>
          <div class="scan-location-state" :class="{ 'is-ready': pickup.location.value }"><ScanIcon :name="pickup.location.value ? 'check' : 'pin'" :size="18" /><div><strong>{{ pickup.location.value ? 'Pickup location set' : 'Where is your item?' }}</strong><p>{{ pickup.label.value }}</p></div></div>
          <p v-if="pickup.source.value === 'demo'" class="scan-demo-note">You’re using the demo pickup point in Nigeria. You can set your own below.</p>
          <p v-else-if="pickup.label.value === 'Saved pickup location'" class="scan-demo-note">Using your saved pickup location. Change it below if this item is elsewhere.</p>
          <BaseButton variant="ghost" class="scan-outline-button scan-full-button" :loading="pickup.pending.value" :disabled="pickup.pending.value || upload.busy.value" @click="pickup.useDeviceLocation()"><ScanIcon v-if="!pickup.pending.value" name="pin" :size="17" />{{ pickup.pending.value ? 'Finding your location…' : 'Use current location' }}</BaseButton>
          <PlacePicker
            class="scan-place-picker"
            input-id="pickup-address"
            :location="pickup.location.value"
            :label="pickup.label.value"
            :disabled="upload.busy.value || pickup.pending.value"
            placeholder="12 Admiralty Way, Lekki, Lagos"
            @select="onPlaceSelect"
          />
          <p v-if="pickup.error.value" class="scan-alert scan-alert--error" role="alert">{{ pickup.error.value }}</p>
        </section>
        <section class="scan-continue-panel" aria-labelledby="next-heading">
          <div class="scan-continue-title"><span class="scan-dark-icon"><ScanIcon name="leaf" :size="22" /></span><h2 id="next-heading">Ready for a second life?</h2></div><p>We’ll save your photo and pickup point, then help identify the material.</p>
          <ul class="scan-readiness"><li :class="{ 'is-ready': upload.file.value }"><span><ScanIcon v-if="upload.file.value" name="check" :size="12" /></span>{{ upload.file.value ? 'Photo added' : 'Add an item photo' }}</li><li :class="{ 'is-ready': pickup.location.value }"><span><ScanIcon v-if="pickup.location.value" name="check" :size="12" /></span>{{ pickup.location.value ? 'Pickup point set' : 'Set a pickup point' }}</li></ul>
          <div v-if="upload.busy.value" class="scan-upload-progress" role="status" aria-live="polite"><div><span>{{ upload.stage.value === 'token' ? 'Preparing your upload' : upload.stage.value === 'saving' ? 'Saving your item' : 'Uploading photo' }}</span><strong>{{ upload.progress.value }}%</strong></div><progress :value="upload.progress.value" max="100" aria-label="Photo upload progress" /></div>
          <BaseButton variant="secondary" class="scan-full-button" :disabled="!upload.file.value || upload.busy.value" :loading="upload.busy.value" @click="saveDraft">{{ upload.uploadedPath.value ? 'Retry saving item' : 'Upload & continue' }}<ScanIcon v-if="!upload.busy.value" name="arrow" :size="18" /></BaseButton>
          <small>You can review the result before requesting pickup.</small>
        </section>
      </aside>
    </div>
  </div>
</template>
