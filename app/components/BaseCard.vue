<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'default' | 'soft' | 'dark' }>(), { tone: 'default' })
</script>

<template>
  <div class="card" :class="`card--${tone}`">
    <div v-if="$slots.header" class="card-header"><slot name="header" /></div>
    <slot />
    <div v-if="$slots.footer" class="card-footer"><slot name="footer" /></div>
  </div>
</template>
