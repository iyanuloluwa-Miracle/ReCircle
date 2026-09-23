<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Workspace — ReCircle', robots: 'noindex' })
</script>

<template>
  <div>
    <p class="eyebrow">A better circle starts here</p>
    <h1 class="page-title">Your recycling workspace.</h1>
    <p class="muted workspace-intro">Sign in to scan items, track pickups, and follow your impact.</p>
    <BaseCard>
      <EmptyState
        title="Ready when you are"
        description="Create an account to open your dashboard, scan recyclables, and request pickup."
      >
        <BaseButton to="/register">Create an account <span aria-hidden="true">↗</span></BaseButton>
        <BaseButton to="/login" variant="secondary">Sign in</BaseButton>
      </EmptyState>
    </BaseCard>
  </div>
</template>
