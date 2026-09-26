<script setup lang="ts">
withDefaults(defineProps<{ name?: string }>(), { name: 'leaf' })
</script>

<template>
  <AppIcon :name="name" class="dashboard-icon" />
</template>
