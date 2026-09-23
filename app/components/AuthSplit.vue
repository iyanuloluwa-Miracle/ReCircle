<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  variant?: 'default' | 'card'
}>(), {
  variant: 'default'
})
</script>

<template>
  <section class="auth-simple" :class="{ 'auth-simple--card': variant === 'card' }">
    <div class="auth-simple-inner">
      <BrandMark />
      <div :class="variant === 'card' ? 'auth-card' : undefined">
        <h1 class="auth-simple-title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-card-lead">{{ subtitle }}</p>
        <slot />
      </div>
    </div>
  </section>
</template>
