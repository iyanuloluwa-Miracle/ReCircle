<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  detail?: string
  loading?: boolean
  accent?: boolean
}>()
</script>

<template>
  <BaseCard class="stat-card" :class="{ 'stat-card--accent': accent }">
    <p class="eyebrow">{{ label }}</p>
    <LoadingSkeleton v-if="loading" :lines="2" />
    <template v-else>
      <p class="stat-value">{{ value ?? '—' }}</p>
      <p v-if="detail" class="muted stat-detail">{{ detail }}</p>
    </template>
  </BaseCard>
</template>
