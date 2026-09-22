<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>

<template>
  <div class="error-page container">
    <BrandMark />
    <EmptyState :title="error.statusCode === 404 ? 'This page is outside the circle.' : 'Something interrupted the journey.'" :description="error.statusCode === 404 ? 'The page may have moved, or the address may be incorrect.' : 'Please try again. Your next step is still here.'">
      <BaseButton @click="clearError({ redirect: '/' })">Back to home</BaseButton>
    </EmptyState>
  </div>
</template>
