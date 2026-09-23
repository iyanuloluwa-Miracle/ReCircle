<script setup lang="ts">
withDefaults(defineProps<{ name?: string }>(), { name: 'leaf' })
const paths: Record<string, string[]> = {
  overview: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  chart: ['M4 3v17h17M8 15v-4M13 15V7M18 15V4'],
  scan: ['M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10M8 8h8v8H8z'],
  arrow: ['M5 12h14M13 6l6 6-6 6'],
  home: ['m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7'],
  leaf: ['M20 4C10 2 3 7 5 14s13 7 15-10ZM4 21 15 10'],
  wallet: ['M4 6V5a2 2 0 0 1 2-2h13v5M4 6h16v15H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM20 12h-5v4h5'],
  truck: ['M3 5h12v12H3zM15 10h4l3 4v3h-7M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
  spark: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z'],
  check: ['m5 12 4 4L19 6'],
  close: ['m6 6 12 12M6 18 18 6'],
  logout: ['M9 4H4v16h5M10 12h11M17 8l4 4-4 4'],
  box: ['m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5.8l10 5.5'],
  calendar: ['M8 2v4M16 2v4M3 10h18M3 4h18v18H3zM8 14h2M14 14h2M8 18h2'],
  people: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.9']
}
</script>
<template>
  <svg class="dashboard-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(path, index) in (paths[name] || paths.leaf)" :key="index" :d="path" />
  </svg>
</template>

