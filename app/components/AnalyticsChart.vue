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
  emptyDescription: 'Charts appear once matching activity is recorded.',
  horizontal: false,
  datasetLabel: 'Value'
})

const canvas = ref<HTMLCanvasElement | null>(null)
const { render } = useChart()
const narrowViewport = ref(false)
let chartMedia: MediaQueryList | null = null

const palette = ['#123f32', '#60813f', '#91a47d', '#d3f28a', '#c9b27c', '#4f6f52', '#833c27', '#a3b18a']
const hasData = computed(() => props.labels.length > 0 && props.values.some(value => value > 0))

function syncChartViewport() {
  if (chartMedia) narrowViewport.value = chartMedia.matches
}

onMounted(() => {
  chartMedia = window.matchMedia('(max-width: 768px)')
  syncChartViewport()
  chartMedia.addEventListener('change', syncChartViewport)
})

onUnmounted(() => {
  chartMedia?.removeEventListener('change', syncChartViewport)
})

watchEffect(async () => {
  if (!canvas.value || props.loading || !hasData.value) return
  const colors = props.labels.map((_, index) => palette[index % palette.length]!)
  const isRing = props.type === 'doughnut' || props.type === 'pie'
  const dataset = {
    label: props.datasetLabel,
    data: props.values,
    backgroundColor: props.type === 'line' ? '#d3f28a66' : colors,
    borderColor: props.type === 'line' ? '#123f32' : isRing ? '#f8f8f0' : colors,
    borderWidth: props.type === 'line' ? 2.5 : isRing ? 3 : 0,
    fill: props.type === 'line',
    tension: 0.4,
    pointRadius: props.type === 'line' ? 3.5 : undefined,
    pointBackgroundColor: props.type === 'line' ? '#123f32' : undefined,
    pointHoverRadius: props.type === 'line' ? 5 : undefined,
    borderRadius: props.type === 'bar' ? 8 : undefined,
    borderSkipped: props.type === 'bar' ? false : undefined,
    maxBarThickness: 36,
    ...(props.type === 'doughnut' ? { cutout: '68%' } : {})
  }
  await render(canvas.value, {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: [dataset as never]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: props.horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: isRing,
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 11, weight: 550 },
            color: '#4f6257'
          }
        },
        title: { display: Boolean(props.title), text: props.title || '', font: { size: 13 } },
        tooltip: {
          backgroundColor: '#123f32',
          titleFont: { size: 12, weight: 650 },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: isRing
        ? undefined
        : {
            x: {
              grid: { color: '#e8eedf' },
              ticks: {
                font: { size: narrowViewport.value ? 10 : 11 },
                color: '#657269',
                maxRotation: narrowViewport.value ? 45 : 0,
                minRotation: narrowViewport.value ? 30 : 0,
                autoSkip: true,
                maxTicksLimit: narrowViewport.value ? 6 : 12
              },
              border: { display: false }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#e8eedf' },
              ticks: { font: { size: 11 }, color: '#657269' },
              border: { display: false }
            }
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
      compact
      symbol="▤"
      :title="emptyTitle"
      :description="emptyDescription"
    />
    <div v-else class="analytics-chart-canvas">
      <canvas ref="canvas" />
    </div>
  </div>
</template>
