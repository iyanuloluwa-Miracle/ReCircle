/** Canonical classifier codes (uppercase) → recycler catalog codes (lowercase). */
const recyclerAliases: Record<string, string[]> = {
  PET: ['pet'],
  HDPE: ['hdpe'],
  LDPE: ['ldpe'],
  PP: ['pp'],
  ALUMINUM: ['aluminium', 'aluminum'],
  STEEL: ['steel'],
  GLASS: ['glass'],
  CARDBOARD: ['cardboard'],
  PAPER: ['paper'],
  EWASTE: ['ewaste', 'e_waste'],
  ORGANIC: ['organic'],
  MIXED: ['mixed'],
  UNKNOWN: ['unknown']
}

/** Normalize any stored material code to the uppercase classifier form. */
export function toCanonicalMaterialCode(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return 'UNKNOWN'
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
  if (upper === 'ALUMINIUM') return 'ALUMINUM'
  if (upper === 'E_WASTE') return 'EWASTE'
  return upper
}

/** Recycler `acceptedMaterials` / pricing keys that match a waste item material. */
export function toRecyclerMaterialCodes(code: string): string[] {
  const canonical = toCanonicalMaterialCode(code)
  return recyclerAliases[canonical] ?? [canonical.toLowerCase()]
}

/** True when a recycler material string matches the waste item material. */
export function materialsMatch(wasteMaterial: string, recyclerMaterial: string): boolean {
  const targets = new Set(toRecyclerMaterialCodes(wasteMaterial))
  return targets.has(recyclerMaterial.trim().toLowerCase())
}
