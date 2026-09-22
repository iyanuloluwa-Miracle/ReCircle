<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  actionTo?: string
  actionLabel?: string
}>()
const { user } = useAuth()
</script>

<template>
  <div>
    <p class="eyebrow">{{ eyebrow }}</p>
    <h1 class="page-title">{{ title }}</h1>
    <p class="muted workspace-intro">{{ description }}</p>
    <BaseCard class="dashboard-account-card">
      <div>
        <p class="eyebrow">Signed in as</p>
        <strong>{{ user?.name }}</strong>
        <span class="muted">{{ user?.email }}</span>
      </div>
      <BaseBadge v-if="user?.isDemo" tone="lime">DEMO ACCOUNT</BaseBadge>
    </BaseCard>
    <BaseCard>
      <EmptyState :title="emptyTitle" :description="emptyDescription">
        <BaseButton v-if="actionTo && actionLabel" :to="actionTo">{{ actionLabel }}</BaseButton>
      </EmptyState>
    </BaseCard>
  </div>
</template>
