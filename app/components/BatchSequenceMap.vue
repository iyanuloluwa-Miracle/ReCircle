<script setup lang="ts">
export interface BatchMapStop {
  order: number
  areaLabel: string
  latitude: number
  longitude: number
}

const props = defineProps<{
  stops: BatchMapStop[]
}>()

const padding = 18

const projected = computed(() => {
  if (!props.stops.length) return []
  const lats = props.stops.map(stop => stop.latitude)
  const lngs = props.stops.map(stop => stop.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latSpan = Math.max(maxLat - minLat, 0.01)
  const lngSpan = Math.max(maxLng - minLng, 0.01)
  const width = 320
  const height = 220
  return props.stops.map((stop) => {
    const x = padding + ((stop.longitude - minLng) / lngSpan) * (width - padding * 2)
    const y = padding + ((maxLat - stop.latitude) / latSpan) * (height - padding * 2)
    return { ...stop, x, y }
  })
})

const pathPoints = computed(() => projected.value.map(stop => `${stop.x},${stop.y}`).join(' '))
</script>

<template>
  <svg
    v-if="projected.length"
    class="batch-map"
    viewBox="0 0 320 220"
    role="img"
    :aria-label="`Suggested sequence map with ${projected.length} stops`"
  >
    <rect x="0" y="0" width="320" height="220" class="batch-map-bg" />
    <polyline
      v-if="projected.length > 1"
      :points="pathPoints"
      class="batch-map-path"
      fill="none"
    />
    <g v-for="stop in projected" :key="`${stop.order}-${stop.areaLabel}`">
      <circle :cx="stop.x" :cy="stop.y" r="11" class="batch-map-marker" />
      <text :x="stop.x" :y="stop.y + 4" text-anchor="middle" class="batch-map-order">{{ stop.order }}</text>
      <text
        v-if="projected.length <= 4"
        :x="stop.x"
        :y="stop.y + 24"
        text-anchor="middle"
        class="batch-map-label"
      >{{ stop.areaLabel.length > 14 ? `${stop.areaLabel.slice(0, 12)}…` : stop.areaLabel }}</text>
    </g>
  </svg>
  <p v-else class="muted">No map points available for this batch.</p>
</template>
