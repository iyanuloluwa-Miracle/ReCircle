import assert from 'node:assert/strict'
import test from 'node:test'

/** Mirrors AnalyticsService month-series filling for stable chart labels. */
function fillMonthSeries(rows: Array<{ month: string; value: number }>, months = 6, now = new Date('2026-09-22T12:00:00.000Z')) {
  const map = new Map(rows.map(row => [row.month, row.value]))
  const series: Array<{ label: string; value: number }> = []
  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const label = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      .toLocaleString('en-NG', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    series.push({ label, value: Math.round((map.get(key) ?? 0) * 100) / 100 })
  }
  return series
}

test('analytics month series pads empty months without fabricating totals', () => {
  const series = fillMonthSeries([{ month: '2026-09', value: 12.5 }], 3)
  assert.equal(series.length, 3)
  assert.equal(series[2]!.value, 12.5)
  assert.equal(series[0]!.value, 0)
  assert.equal(series[1]!.value, 0)
})
