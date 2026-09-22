<script setup lang="ts">
defineProps<{ label: string; value?: string; detail?: string; loading?: boolean }>()
</script>

<template>
  <BaseCard class="stat-card">
    <p class="eyebrow">{{ label }}</p>
    <LoadingSkeleton v-if="loading" :lines="2" />
    <template v-else>
      <p class="stat-value">{{ value ?? '—' }}</p>
      <p v-if="detail" class="muted">{{ detail }}</p>
    </template>
  </BaseCard>
</template>
