<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Availability — ReCircle', robots: 'noindex' })

interface RecyclerProfile {
  businessName: string
  availability: 'available' | 'busy' | 'offline'
  businessHours: string
  operatingHours: Array<{ day: number; open: string; close: string; enabled: boolean }>
  contactPhone: string | null
  serviceRadiusKm: number
  capacityKgPerDay: number
  acceptedMaterials: string[]
  pricingRules: Array<{ material: string; pricePerKg: number; currency: 'NGN' }>
}

const { data, pending, error, refresh } = await useAsyncData('recycler-availability-profile', async () => {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  return fetcher<RecyclerProfile>('/api/recycler/profile')
})
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Recycler workspace</p>
        <h1 class="page-title">Availability & pricing.</h1>
        <p class="muted workspace-intro">
          Control whether new consumer matches can reach you, plus hours, materials, and rates.
        </p>
      </div>
      <div class="dash-hero-actions">
        <BaseBadge v-if="data" :tone="data.availability === 'available' ? 'green' : 'warning'">
          {{ data.availability.toUpperCase() }}
        </BaseBadge>
        <BaseButton to="/dashboard/recycler" variant="secondary" class="dash-cta">Back to overview</BaseButton>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" variant="dashboard" label="Loading availability settings" />
    <BaseCard v-else-if="error" class="dash-error-card">
      <EmptyState title="Could not load availability" description="Refresh the page or try again shortly.">
        <BaseButton @click="refresh()">Retry</BaseButton>
      </EmptyState>
    </BaseCard>
    <DashboardSection
      v-else-if="data"
      title="Matching settings"
      description="These settings decide if consumers can match you and what payout they see."
    >
      <RecyclerAvailabilityPanel :profile="data" @saved="refresh" />
    </DashboardSection>
  </div>
</template>
