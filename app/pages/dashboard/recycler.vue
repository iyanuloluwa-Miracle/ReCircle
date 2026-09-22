<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Recycler workspace — Recykle AI', robots: 'noindex' })
</script>

<template>
  <DashboardWelcome
    eyebrow="Recycler workspace"
    title="Give materials a new direction."
    description="This is your recycling business space. Incoming pickup requests arrive in a later phase."
    empty-title="No pickup requests yet"
    empty-description="Suitable requests will appear here once matching and pickup coordination are live."
  />
</template>
