<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'green' | 'lime' | 'warning' }>(), { tone: 'neutral' })
</script>

<template><span class="badge" :class="`badge--${tone}`"><slot /></span></template>
