<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  compact?: boolean
  symbol?: string
}>(), {
  compact: false,
  symbol: '↗'
})
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <span class="empty-symbol" aria-hidden="true">{{ symbol }}</span>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.default" class="empty-action"><slot /></div>
  </div>
</template>
