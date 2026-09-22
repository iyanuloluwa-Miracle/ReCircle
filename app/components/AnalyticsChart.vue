<script setup lang="ts">
import type { ChartType } from 'chart.js'

const props = withDefaults(defineProps<{
  type: ChartType
  labels: string[]
  values: number[]
  loading?: boolean
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  horizontal?: boolean
  datasetLabel?: string
}>(), {
  loading: false,
  emptyTitle: 'No data yet',
  emptyDescription: 'Charts appear once matching activity is recorded in MongoDB.',
  horizontal: false,
  datasetLabel: 'Value'
})

const canvas = ref<HTMLCanvasElement | null>(null)
const { render } = useChart()

const palette = ['#123f32', '#60813f', '#d3f28a', '#91a47d', '#c9b27c', '#833c27', '#4f6f52', '#a3b18a']
const hasData = computed(() => props.labels.length > 0 && props.values.some(value => value > 0))

watchEffect(async () => {
  if (!canvas.value || props.loading || !hasData.value) return
  const colors = props.labels.map((_, index) => palette[index % palette.length]!)
  await render(canvas.value, {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: [{
        label: props.datasetLabel,
        data: props.values,
        backgroundColor: props.type === 'line' ? '#60813f55' : colors,
        borderColor: props.type === 'line' ? '#123f32' : colors,
        borderWidth: props.type === 'line' ? 2 : 0,
        fill: props.type === 'line',
        tension: 0.35,
        pointRadius: props.type === 'line' ? 3 : undefined,
        borderRadius: props.type === 'bar' ? 6 : undefined
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: props.horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: props.type === 'doughnut' || props.type === 'pie',
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        title: { display: Boolean(props.title), text: props.title || '', font: { size: 13 } }
      },
      scales: props.type === 'doughnut' || props.type === 'pie'
        ? undefined
        : {
            x: { grid: { color: '#e5ebdc' }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#e5ebdc' }, ticks: { font: { size: 11 } } }
          }
    }
  })
})
</script>

<template>
  <div class="analytics-chart" role="img" :aria-label="title || datasetLabel">
    <LoadingSkeleton v-if="loading" :lines="5" label="Loading chart" />
    <EmptyState
      v-else-if="!hasData"
      :title="emptyTitle"
      :description="emptyDescription"
    />
    <canvas v-else ref="canvas" />
  </div>
</template>
