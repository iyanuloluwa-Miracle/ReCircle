<script setup lang="ts">
defineProps<{
  metrics: Array<{ label: string; value: string; detail?: string }>
  loading?: boolean
}>()
</script>

<template>
  <div class="dash-metrics" role="group" aria-label="Key metrics" :aria-busy="loading || undefined">
    <StatCard
      v-for="(metric, index) in metrics"
      :key="metric.label"
      :label="metric.label"
      :value="loading ? undefined : metric.value"
      :detail="loading ? undefined : metric.detail"
      :loading="loading"
      :accent="index === 0"
    />
  </div>
</template>

