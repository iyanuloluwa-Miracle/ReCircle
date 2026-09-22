const numberFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 })
const currencyFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatNaira(value: number): string {
  return `NGN ${currencyFormatter.format(Math.round(value))}`
}
