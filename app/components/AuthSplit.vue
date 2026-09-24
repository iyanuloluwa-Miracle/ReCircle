<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  variant?: 'default' | 'card'
  steps?: string[]
  currentStep?: number
}>(), {
  variant: 'default',
  steps: () => [],
  currentStep: 1
})
</script>

<template>
  <section class="auth-simple" :class="{ 'auth-simple--card': variant === 'card' }">
    <div class="auth-simple-inner" :class="{ 'auth-simple-inner--wide': steps.length > 4 }">
      <BrandMark />
      <OnboardingSteps v-if="steps.length" :steps="steps" :current="currentStep" />
      <div :class="variant === 'card' ? 'auth-card' : undefined">
        <h1 class="auth-simple-title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-card-lead">{{ subtitle }}</p>
        <slot />
      </div>
    </div>
  </section>
</template>
