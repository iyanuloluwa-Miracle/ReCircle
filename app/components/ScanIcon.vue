<script setup lang="ts">
withDefaults(defineProps<{
  name: 'camera' | 'image' | 'pin' | 'arrow' | 'check' | 'sparkles' | 'leaf' | 'scale' | 'chevron' | 'trash' | 'refresh' | 'building' | 'shield' | 'upload'
  size?: number
}>(), { size: 20 })
</script>

<template>
  <AppIcon :name="name" :size="size" />
</template>
