<script setup lang="ts">
import { formatNumber } from '~~/utils/format'

const props = defineProps<{
  items: Array<{ label: string; value: number; detail?: string }>
  unit?: string
}>()

const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0))
</script>

<template>
  <div v-if="items.length" class="breakdown-list">
    <div v-for="item in items" :key="item.label" class="breakdown-row">
      <div class="breakdown-copy">
        <strong>{{ item.label }}</strong>
        <span class="muted">{{ item.detail || `${formatNumber(item.value)}${unit ? ` ${unit}` : ''}` }}</span>
      </div>
      <div class="breakdown-track" aria-hidden="true">
        <span :style="{ width: `${total > 0 ? Math.max(4, (item.value / total) * 100) : 0}%` }" />
      </div>
    </div>
  </div>
  <EmptyState v-else title="No material data yet" description="Completed and accepted pickups will appear here by material." />
</template>
