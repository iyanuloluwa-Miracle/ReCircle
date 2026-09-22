<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  visualImage: string
  visualAlt?: string
}>(), {
  visualAlt: '',
})
</script>

<template>
  <section class="auth-split">
    <div class="auth-split-form">
      <div class="auth-split-form-inner">
        <BrandMark />
        <h1 class="auth-split-title">{{ title }}</h1>
        <slot />
      </div>
    </div>

    <aside class="auth-split-visual" aria-hidden="true">
      <div class="auth-split-visual-frame">
        <img
          class="auth-split-visual-image"
          :src="visualImage"
          :alt="visualAlt"
          width="1200"
          height="1600"
        >
        <div class="auth-split-visual-scrim" />
      </div>
    </aside>
  </section>
</template>
