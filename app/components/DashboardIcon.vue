<script setup lang="ts">
withDefaults(defineProps<{
  name?: string
  tone?: 'plain' | 'brand'
}>(), {
  name: 'leaf',
  tone: 'plain'
})
</script>

<template>
  <AppIcon :name="name" :tone="tone" class="dashboard-icon" />
</template>
