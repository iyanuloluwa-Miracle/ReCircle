<script setup lang="ts">
import { formatNumber } from '~~/utils/format'

defineProps<{
  capacityKgPerDay: number
  currentLoadKg: number
  remainingCapacityKg: number
  utilizationPct: number
}>()
</script>

<template>
  <div class="capacity-meter">
    <div class="capacity-meter-head">
      <strong>{{ formatNumber(utilizationPct) }}% utilized</strong>
      <span class="muted">{{ formatNumber(currentLoadKg) }} / {{ formatNumber(capacityKgPerDay) }} kg today</span>
    </div>
    <div class="capacity-meter-track" role="meter" :aria-valuenow="utilizationPct" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ width: `${Math.min(100, utilizationPct)}%` }" />
    </div>
    <p class="muted">{{ formatNumber(remainingCapacityKg) }} kg remaining capacity</p>
  </div>
</template>
