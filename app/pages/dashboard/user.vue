<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Consumer workspace — Recykle AI', robots: 'noindex' })
</script>

<template>
  <DashboardWelcome
    eyebrow="Consumer workspace"
    title="Your next good turn starts here."
    description="Welcome to your recycling space. Start with a photo; AI analysis and pickups arrive in a later phase."
    empty-title="No waste items yet"
    empty-description="Upload a recyclable photo to start a draft. Analysis and pickup requests will follow in a later phase."
    action-to="/scan"
    action-label="Scan an item"
  />
</template>
