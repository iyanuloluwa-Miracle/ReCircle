<script setup lang="ts">
import type { TimelineStep } from '~~/utils/request-lifecycle'

defineProps<{
  steps: TimelineStep[]
}>()
</script>

<template>
  <ol class="status-timeline" aria-label="Pickup status timeline">
    <li
      v-for="step in steps"
      :key="step.id"
      class="status-timeline-step"
      :data-state="step.state"
    >
      <span class="status-timeline-marker" aria-hidden="true" />
      <div class="status-timeline-copy">
        <strong>{{ step.label }}</strong>
        <span class="status-timeline-state">[{{ step.state }}]</span>
        <time v-if="step.at" :datetime="step.at">{{ new Date(step.at).toLocaleString('en-NG') }}</time>
      </div>
    </li>
  </ol>
</template>
