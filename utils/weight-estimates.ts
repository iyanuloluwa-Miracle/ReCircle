export interface WeightEstimateOption {
  id: string
  label: string
  description: string
  gramsEach: number
  materials: string[]
  keywords: string[]
}

/** Typical empty, clean-container weights. They help users estimate; they are not settlement weights. */
export const weightEstimateOptions: WeightEstimateOption[] = [
  { id: 'pet-small-bottle', label: 'Small plastic water bottle', description: 'Typical empty PET bottle', gramsEach: 12, materials: ['PET'], keywords: ['water bottle', 'small bottle', 'plastic bottle'] },
  { id: 'pet-large-bottle', label: 'Large plastic bottle (1–2 L)', description: 'Typical empty PET bottle', gramsEach: 32, materials: ['PET'], keywords: ['1.5l', '2l', 'large bottle', 'large plastic bottle'] },
  { id: 'aluminium-can', label: 'Aluminium drink can', description: 'Typical empty can', gramsEach: 14, materials: ['ALUMINUM', 'ALUMINIUM'], keywords: ['can', 'aluminium', 'aluminum'] },
  { id: 'steel-food-can', label: 'Food tin / steel can', description: 'Typical empty food can', gramsEach: 45, materials: ['STEEL', 'TIN'], keywords: ['tin', 'food can', 'steel can'] },
  { id: 'glass-bottle', label: 'Glass bottle', description: 'Typical empty glass bottle', gramsEach: 350, materials: ['GLASS'], keywords: ['glass bottle', 'glass'] },
  { id: 'cardboard-box', label: 'Small cardboard box', description: 'Typical dry cardboard box', gramsEach: 180, materials: ['CARDBOARD', 'PAPER'], keywords: ['cardboard', 'box'] }
]

export function suggestedWeightEstimate(itemName: string | null, materialCode: string | null) {
  const name = itemName?.toLowerCase() ?? ''
  const material = materialCode?.toUpperCase() ?? ''
  return weightEstimateOptions
    .map(option => ({ option, score: (option.materials.includes(material) ? 2 : 0) + (option.keywords.some(keyword => name.includes(keyword)) ? 1 : 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.option ?? null
}

export function estimatedWeightKg(gramsEach: number, quantity: number) {
  if (!Number.isFinite(gramsEach) || !Number.isFinite(quantity) || gramsEach <= 0 || quantity <= 0) return null
  return Math.round((gramsEach * quantity / 1000) * 1000) / 1000
}
