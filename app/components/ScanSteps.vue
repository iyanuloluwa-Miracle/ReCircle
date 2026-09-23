<script setup lang="ts">
const props = defineProps<{ current: 1 | 2 | 3; itemId?: string }>()
const steps = [
  { number: 1, title: 'Capture', detail: 'Photo & pickup point' },
  { number: 2, title: 'Analyze', detail: 'Material & weight' },
  { number: 3, title: 'Find a recycler', detail: 'Value & pickup' }
]
function stepLink(number: number) {
  if (number === 1) return '/scan'
  if (number === 2 && props.itemId) return `/scan/${props.itemId}/analysis`
  return undefined
}
</script>

<template>
  <nav class="scan-steps" aria-label="Recycling steps">
    <ol>
      <li v-for="step in steps" :key="step.number" :class="{ 'is-current': current === step.number, 'is-complete': current > step.number }" :aria-current="current === step.number ? 'step' : undefined">
        <NuxtLink v-if="step.number < current" :to="stepLink(step.number)" class="scan-step-content">
          <span class="scan-step-number"><ScanIcon name="check" :size="17" /></span>
          <span><strong>{{ step.title }}</strong><small>{{ step.detail }}</small></span>
        </NuxtLink>
        <div v-else class="scan-step-content">
          <span class="scan-step-number">{{ step.number.toString().padStart(2, '0') }}</span>
          <span><strong>{{ step.title }}</strong><small>{{ step.detail }}</small></span>
        </div>
        <ScanIcon v-if="step.number < 3" name="chevron" :size="16" class="scan-step-chevron" />
      </li>
    </ol>
  </nav>
</template>

<style src="~/assets/css/scan-workspace.css" />
