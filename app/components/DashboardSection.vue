<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="dash-section">
    <header class="dash-section-head">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="description" class="muted">{{ description }}</p>
      </div>
      <div v-if="$slots.action" class="dash-section-action"><slot name="action" /></div>
    </header>
    <div class="dash-section-body">
      <slot />
    </div>
  </section>
</template>
