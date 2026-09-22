<script setup lang="ts">
const props = withDefaults(defineProps<{
  to?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}>(), { to: undefined, variant: 'primary', size: 'md', type: 'button' })
const classes = computed(() => ['button', `button--${props.variant}`, `button--${props.size}`])
</script>

<template>
  <NuxtLink v-if="to && !disabled && !loading" :to="to" :class="classes"><slot /></NuxtLink>
  <button v-else :class="classes" :type="type" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
    <span v-if="loading" class="sr-only">Loading</span>
  </button>
</template>
