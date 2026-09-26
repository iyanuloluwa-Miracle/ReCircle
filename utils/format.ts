const numberFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 })
const wholeNairaFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })
const fractionalNairaFormatter = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Format Naira for UI. Whole amounts stay compact; fractional amounts keep 2 decimals (e.g. NGN 1.08). */
export function formatNaira(value: number): string {
  if (!Number.isFinite(value)) return 'NGN 0'
  const rounded = Math.round(value * 100) / 100
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-9
  if (isWhole) return `NGN ${wholeNairaFormatter.format(Math.round(rounded))}`
  return `NGN ${fractionalNairaFormatter.format(rounded)}`
}

export function formatPickupTime(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
