<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Workspace preview — Recykle AI', robots: 'noindex' })
</script>

<template>
  <div>
    <p class="eyebrow">A better circle starts here</p>
    <h1 class="page-title">Room for what comes next.</h1>
    <p class="muted workspace-intro">A first look at your Recykle AI workspace.</p>
    <BaseCard>
      <EmptyState title="Your workspace is taking shape" description="This is a public preview. Accounts are ready; recycling requests and activity arrive in a later phase.">
        <BaseButton to="/demo">Try the demo <span aria-hidden="true">↗</span></BaseButton>
      </EmptyState>
    </BaseCard>
  </div>
</template>
