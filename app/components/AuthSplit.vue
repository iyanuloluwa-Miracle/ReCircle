<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="auth-simple">
    <div class="auth-simple-inner">
      <BrandMark />
      <h1 class="auth-simple-title">{{ title }}</h1>
      <slot />
    </div>
  </section>
</template>
