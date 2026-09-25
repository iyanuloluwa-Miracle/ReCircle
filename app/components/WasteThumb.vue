<script setup lang="ts">
const props = defineProps<{
  src?: string | null
  alt: string
}>()

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <img
    v-if="src && !failed"
    class="waste-thumb"
    :src="src"
    :alt="alt"
    loading="lazy"
    @error="failed = true"
  >
  <span
    v-else
    class="waste-thumb waste-thumb--fallback"
    role="img"
    :aria-label="alt"
  >
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L8 19" />
    </svg>
  </span>
</template>

<style scoped>
.waste-thumb--fallback {
  display: grid;
  place-items: center;
  background: #123f32;
  color: #c2d3c4;
}
</style>
