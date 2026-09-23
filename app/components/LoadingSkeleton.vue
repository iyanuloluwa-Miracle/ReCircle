<script setup lang="ts">
withDefaults(defineProps<{
  lines?: number
  label?: string
  variant?: 'lines' | 'dashboard'
}>(), {
  lines: 3,
  label: 'Loading content',
  variant: 'lines'
})
</script>

<template>
  <div
    class="skeleton-group"
    :class="{ 'skeleton-group--dashboard': variant === 'dashboard' }"
    role="status"
  >
    <span class="sr-only">{{ label }}</span>
    <template v-if="variant === 'dashboard'">
      <div class="skeleton-metrics" aria-hidden="true">
        <div v-for="n in 4" :key="`m-${n}`" class="skeleton-metric">
          <div class="skeleton skeleton--label" />
          <div class="skeleton skeleton--value" />
          <div class="skeleton skeleton--short" />
        </div>
      </div>
      <div class="skeleton-panels" aria-hidden="true">
        <div v-for="n in 2" :key="`p-${n}`" class="skeleton-panel">
          <div class="skeleton skeleton--heading" />
          <div class="skeleton" />
          <div class="skeleton" />
          <div class="skeleton skeleton--short" />
        </div>
      </div>
    </template>
    <template v-else>
      <div
        v-for="line in lines"
        :key="line"
        class="skeleton"
        :class="{ 'skeleton--short': line === lines }"
        aria-hidden="true"
      />
    </template>
  </div>
</template>
