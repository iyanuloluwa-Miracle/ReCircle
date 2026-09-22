<script setup lang="ts">
withDefaults(defineProps<{ lines?: number; label?: string }>(), { lines: 3, label: 'Loading content' })
</script>

<template>
  <div class="skeleton-group" role="status">
    <span class="sr-only">{{ label }}</span>
    <div v-for="line in lines" :key="line" class="skeleton" :class="{ 'skeleton--short': line === lines }" aria-hidden="true" />
  </div>
</template>
