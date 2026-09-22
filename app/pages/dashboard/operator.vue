<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Operator workspace — Recykle AI', robots: 'noindex' })
</script>

<template>
  <DashboardWelcome
    eyebrow="Waste operator workspace"
    title="Keep the circle moving."
    description="Coordinate recycling activity from this space. Operational tools arrive in a later phase."
    empty-title="Nothing to coordinate yet"
    empty-description="Pickup activity and coordination tools will appear here as those workflows are built."
  />
</template>
