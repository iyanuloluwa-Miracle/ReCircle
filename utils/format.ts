const numberFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 })

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}
