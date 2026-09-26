<script setup lang="ts">
withDefaults(defineProps<{
  name: 'camera' | 'image' | 'pin' | 'arrow' | 'check' | 'sparkles' | 'leaf' | 'scale' | 'chevron' | 'trash' | 'refresh' | 'building' | 'shield' | 'upload'
  size?: number
  tone?: 'plain' | 'brand'
}>(), {
  size: 20,
  tone: 'plain'
})
</script>

<template>
  <AppIcon :name="name" :size="size" :tone="tone" />
</template>
