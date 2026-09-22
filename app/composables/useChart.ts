import type { Chart, ChartConfiguration, ChartType } from 'chart.js'

/** Load Chart.js only when a mounted component asks for a chart. */
export function useChart<T extends ChartType>() {
  let chart: Chart<T> | undefined
  let disposed = false
  onBeforeUnmount(() => { disposed = true; chart?.destroy() })

  async function render(canvas: HTMLCanvasElement, config: ChartConfiguration<T>) {
    if (import.meta.server || disposed) return
    const { default: ChartConstructor } = await import('chart.js/auto')
    if (disposed) return
    chart?.destroy()
    chart = new ChartConstructor(canvas, config)
  }

  return { render, destroy: () => { chart?.destroy(); chart = undefined } }
}
