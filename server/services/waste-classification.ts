import { z } from 'zod'
import { conservativeConfidence, materialCodes, recyclabilityValues } from '../../utils/classification'
import { getOpenRouterTransport } from './openrouter'

export { materialCodes, recyclabilityValues }

export const classificationSchema = z.strictObject({
  itemName: z.string().trim().min(2).max(100),
  materialCode: z.enum(materialCodes),
  recyclability: z.enum(recyclabilityValues),
  confidence: z.number().finite().min(0).max(1),
  disposalMethod: z.string().trim().min(2).max(500),
  preparationInstructions: z.array(z.string().trim().min(2).max(200)).max(8),
  hazardWarning: z.string().trim().min(2).max(300).nullable()
})

export type WasteClassification = z.infer<typeof classificationSchema>
export const LOW_CONFIDENCE_THRESHOLD = 0.65

export const classificationJsonSchema = {
  type: 'object',
  properties: {
    itemName: { type: 'string', description: 'Plain name for the visible item' },
    materialCode: { type: 'string', enum: materialCodes },
    recyclability: { type: 'string', enum: recyclabilityValues },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    disposalMethod: { type: 'string', description: 'Safe disposal guidance for this item' },
    preparationInstructions: { type: 'array', items: { type: 'string' } },
    hazardWarning: { type: ['string', 'null'] }
  },
  required: ['itemName', 'materialCode', 'recyclability', 'confidence', 'disposalMethod', 'preparationInstructions', 'hazardWarning'],
  additionalProperties: false
} as const

export const classifierSystemPrompt = `You are a conservative waste-material classifier.
Identify only information visible or reasonably inferable from the image.
Do not estimate financial value.
Do not estimate weight.
Do not invent brand-specific material composition.
If uncertain between materials, return UNKNOWN or MIXED and reduce confidence.
Waste may contain contamination.
Safety takes priority over recycling.
When an item may contain a battery, sharp edge, chemical, or other hazard, explain safe handling in hazardWarning.
Return only the requested JSON fields.`

export function parseClassificationResponse(response: unknown): WasteClassification {
  const envelope = z.object({
    choices: z.array(z.object({
      finish_reason: z.string().nullable().optional(),
      message: z.object({ content: z.string().nullable(), refusal: z.string().nullable().optional() })
    })).min(1)
  }).safeParse(response)
  const choice = envelope.success ? envelope.data.choices[0] : null
  if (!choice || choice.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) {
    throw new Error('Incomplete or refused classification')
  }
  let content: unknown
  try { content = JSON.parse(choice.message.content) } catch { throw new Error('Invalid classification JSON') }
  const parsed = classificationSchema.safeParse(content)
  if (!parsed.success) throw new Error('Invalid classification fields')
  const classification = parsed.data
  classification.confidence = conservativeConfidence(classification.materialCode, classification.confidence)
  return classification
}

export async function classifyWasteImage(imageUrl: string): Promise<WasteClassification> {
  const transport = getOpenRouterTransport()
  const response = await transport.request({
    messages: [
      { role: 'system', content: classifierSystemPrompt },
      { role: 'user', content: [
        { type: 'text', text: 'Identify this waste item and return the requested JSON. Treat unclear or contaminated items conservatively.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ] }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'waste_classification', strict: true, schema: classificationJsonSchema } },
    provider: { require_parameters: true },
    temperature: 0,
    max_tokens: 500
  })
  return parseClassificationResponse(response)
}
