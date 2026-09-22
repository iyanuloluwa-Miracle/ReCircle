<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  values: number[]
  title?: string
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const { render } = useChart<'doughnut'>()

watchEffect(async () => {
  if (!canvas.value || !props.labels.length) return
  await render(canvas.value, {
    type: 'doughnut',
    data: {
      labels: props.labels,
      datasets: [{
        data: props.values,
        backgroundColor: ['#123f32', '#60813f', '#d3f28a', '#91a47d', '#c9b27c', '#833c27'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: Boolean(props.title), text: props.title || '' }
      }
    }
  })
})
</script>

<template>
  <div class="dash-chart">
    <canvas v-if="labels.length" ref="canvas" />
    <EmptyState v-else title="No status data yet" description="Pickup activity will populate this chart." />
  </div>
</template>
