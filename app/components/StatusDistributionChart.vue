<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  values: number[]
  title?: string
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const { render } = useChart<'doughnut'>()
const hasData = computed(() => props.labels.length > 0 && props.values.some(v => v > 0))

watchEffect(async () => {
  if (!canvas.value || !hasData.value) return
  await render(canvas.value, {
    type: 'doughnut',
    data: {
      labels: props.labels,
      datasets: [{
        data: props.values,
        backgroundColor: ['#123f32', '#60813f', '#91a47d', '#d3f28a', '#c9b27c', '#4f6f52'],
        borderColor: '#fffef9',
        borderWidth: 3,
        cutout: '68%'
      } as never]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            font: { size: 11, weight: 550 },
            color: '#4f6257'
          }
        },
        title: { display: Boolean(props.title), text: props.title || '' },
        tooltip: {
          backgroundColor: '#123f32',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  })
})
</script>

<template>
  <div class="dash-chart">
    <div v-if="hasData" class="analytics-chart-canvas">
      <canvas ref="canvas" />
    </div>
    <EmptyState
      v-else
      compact
      symbol="▤"
      title="No status data yet"
      description="Pickup activity will populate this chart."
    />
  </div>
</template>
