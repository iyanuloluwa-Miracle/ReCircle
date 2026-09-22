export const materialCodes = ['PET', 'HDPE', 'LDPE', 'PP', 'ALUMINUM', 'STEEL', 'GLASS', 'CARDBOARD', 'PAPER', 'EWASTE', 'ORGANIC', 'MIXED', 'UNKNOWN'] as const
export const recyclabilityValues = ['recyclable', 'conditionally_recyclable', 'non_recyclable'] as const

/** Ambiguous materials always require the consumer's confirmation. */
export function conservativeConfidence(materialCode: string, confidence: number) {
  return materialCode === 'UNKNOWN' || materialCode === 'MIXED' ? Math.min(confidence, 0.64) : confidence
}
