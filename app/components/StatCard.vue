<script setup lang="ts">
const props = defineProps<{ label: string; value?: string; detail?: string; loading?: boolean; accent?: boolean }>()
const icon = computed(() => {
  const label = props.label.toLowerCase()
  if (/earn|payout|value|reward|purchase/.test(label)) return 'wallet'
  if (/streak/.test(label)) return 'spark'
  if (/complete/.test(label)) return 'check'
  if (/pickup|collection|job/.test(label)) return 'truck'
  if (/recycler/.test(label)) return 'people'
  if (/scan|item/.test(label)) return 'scan'
  return 'leaf'
})
</script>
<template>
  <BaseCard class="stat-card" :class="{ 'stat-card--accent': accent }">
    <div class="stat-card-top"><p class="eyebrow">{{ label }}</p><span class="stat-icon"><DashboardIcon :name="icon" /></span></div>
    <LoadingSkeleton v-if="loading" :lines="2" />
    <template v-else><p class="stat-value">{{ value ?? '—' }}</p><p v-if="detail" class="muted stat-detail">{{ detail }}</p></template>
  </BaseCard>
</template>

