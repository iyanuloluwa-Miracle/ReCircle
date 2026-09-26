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
    <AppIcon name="image" :size="22" />
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
