<script setup lang="ts">
const props = defineProps<{
  steps: string[]
  current: number
}>()

const items = computed(() => props.steps.map((label, index) => {
  const number = index + 1
  return {
    number,
    label,
    complete: number < props.current,
    current: number === props.current
  }
}))
</script>

<template>
  <nav class="onboard-progress" aria-label="Onboarding progress">
    <ol class="onboard-progress-list">
      <li
        v-for="(step, index) in items"
        :key="step.number"
        class="onboard-progress-item"
        :class="{
          'is-complete': step.complete,
          'is-current': step.current
        }"
        :aria-current="step.current ? 'step' : undefined"
      >
        <span class="onboard-progress-node" aria-hidden="true">{{ step.number }}</span>
        <span class="onboard-progress-label">{{ step.label }}</span>
        <span
          v-if="index < items.length - 1"
          class="onboard-progress-line"
          :class="{ 'is-filled': step.complete }"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>
