<script setup lang="ts">
withDefaults(defineProps<{ name: 'camera' | 'image' | 'pin' | 'arrow' | 'check' | 'sparkles' | 'leaf' | 'scale' | 'chevron' | 'trash' | 'refresh' | 'building' | 'shield' | 'upload'; size?: number }>(), { size: 20 })
const paths = {
  camera: 'M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  image: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 13 5-5 4 4 3-3 6 6M8 7h.01',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4',
  leaf: 'M20 4c-9-2-17 3-16 10 1 6 8 7 12 3 3-3 3-8 4-13ZM4 21l10-11M7 17v-5m0 5h5',
  scale: 'M5 7h14l3 14H2L5 7ZM8 7V5a4 4 0 0 1 8 0v2m-4 5v4',
  chevron: 'm9 5 7 7-7 7',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  refresh: 'M20 7a9 9 0 1 0 1 8M20 3v5h-5',
  building: 'M4 21V3h12v18M16 9h4v12M2 21h20M8 7h4m-4 4h4m-4 4h4m-3 6v-3h2v3',
  shield: 'm12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Zm-4 10 3 3 5-6',
  upload: 'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6'
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name]" /></svg>
</template>
