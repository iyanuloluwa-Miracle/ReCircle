<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Consumer workspace — Recykle AI', robots: 'noindex' })
</script>

<template>
  <DashboardWelcome
    eyebrow="Consumer workspace"
    title="Your next good turn starts here."
    description="Welcome to your recycling space. Photo analysis and pickup requests arrive in a later phase."
    empty-title="No waste items yet"
    empty-description="When waste analysis is available, your items and pickup requests will appear here."
  />
</template>
