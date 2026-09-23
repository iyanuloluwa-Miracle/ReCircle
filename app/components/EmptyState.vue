<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  description: string
  compact?: boolean
  symbol?: string
}>(), { compact: false, symbol: undefined })
const icon = computed(() => {
  const text = props.title.toLowerCase()
  if (/scan|photo|item/.test(text)) return 'scan'
  if (/wallet|earning|reward/.test(text)) return 'wallet'
  if (/pickup|collection|request/.test(text)) return 'truck'
  if (/chart|activity|data|analytic/.test(text)) return 'chart'
  return 'leaf'
})
</script>
<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <span class="empty-symbol" aria-hidden="true"><DashboardIcon :name="icon" /></span>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.default" class="empty-action"><slot /></div>
  </div>
</template>
