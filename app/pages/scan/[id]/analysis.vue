<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Image ready for analysis — Recykle AI', robots: 'noindex' })

const route = useRoute()
const id = String(route.params.id)
const { data, pending, error } = await useAsyncData(`waste-draft-${id}`, async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<{ id: string; imageUrl: string; status: string; locationSource: string | null }>(`/api/waste-items/${id}`)
})
</script>

<template>
  <div class="analysis-step">
    <p class="eyebrow">02 / Analysis handoff</p>
    <h1 class="page-title">Your photo is safely in the circle.</h1>
    <p class="muted workspace-intro">The image and pickup location are saved. Material identification will be added in the next phase.</p>
    <LoadingSkeleton v-if="pending" />
    <BaseCard v-else-if="error">
      <EmptyState title="Could not load this draft" description="The draft may be unavailable or belong to another account. Return to the scanner and try again.">
        <BaseButton to="/scan">Back to scanner</BaseButton>
      </EmptyState>
    </BaseCard>
    <div v-else-if="data" class="analysis-preview-card">
      <img :src="data.imageUrl" alt="Uploaded recyclable item awaiting analysis">
      <div class="analysis-preview-details">
        <BaseBadge tone="lime">DRAFT SAVED</BaseBadge>
        <h2>Ready for a closer look.</h2>
        <p class="muted">We haven’t identified a material, estimated weight, or calculated a price yet.</p>
        <p class="analysis-location">Pickup location: {{ data.locationSource === 'demo' ? 'Demo Lagos location' : data.locationSource === 'device' ? 'Current device location' : 'Manually entered location' }}</p>
        <BaseButton to="/scan" variant="secondary">Scan another item</BaseButton>
      </div>
    </div>
  </div>
</template>
