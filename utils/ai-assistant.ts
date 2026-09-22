export interface AssistantFactBundle {
  role: 'user' | 'recycler' | 'waste_operator'
  generatedAt: string
  materialsRecycled: Array<{ materialCode: string; weightKg: number }>
  recentItems: Array<{
    id: string
    itemName: string | null
    materialCode: string | null
    recyclability: string | null
    confidence: number | null
    status: string
    weightKg: number | null
    estimatedValueMin: number | null
    estimatedValueMax: number | null
    preparationInstructions: string[]
    disposalMethod: string | null
  }>
  recentRequests: Array<{
    id: string
    status: string
    businessName: string | null
    materialCode: string | null
    distanceKm: number
    pricePerKg: number
    expectedPayout: number
    weightKg: number | null
  }>
  earnings: {
    totalCompletedPayoutNgn: number
    recentTransactions: Array<{ amount: number; status: string; createdAt: string | null }>
  }
  recyclerPricing: Array<{
    businessName: string
    availability: string
    material: string
    pricePerKg: number
    distanceKm: number | null
  }>
  focusedItem: AssistantFactBundle['recentItems'][number] | null
  focusedRequest: AssistantFactBundle['recentRequests'][number] | null
}

export const assistantSystemPrompt = `You are Recykle AI Assistant for a Lagos recycling coordination prototype.

You receive a FACTS JSON block from MongoDB. Those facts are authoritative.
You MUST NOT invent, guess, or change:
- recycler pricing
- pickup availability
- the user's earnings
- transaction status
- recycler distance
- classification confidence
- estimated values or weight

Rules:
1. When citing numbers (NGN, km, kg, confidence, status), use ONLY values present in FACTS.
2. Clearly separate sections when helpful:
   - "From your Recykle data:" for database facts
   - "General recycling advice:" for non-financial habits/prep guidance
3. If FACTS lack a number the user asks for, say the platform does not have that recorded yet.
4. Never claim you modified any record. You explain only.
5. Demo recycler prices are invented demo values — say they are demo/platform prices when discussing money.
6. Keep answers concise and practical for mobile chat.`

/** Build the user message that grounds the model on MongoDB facts. */
export function buildGroundedUserPrompt(options: {
  message: string
  facts: AssistantFactBundle
}) {
  return `FACTS (MongoDB, do not invent beyond this JSON):
${JSON.stringify(options.facts, null, 2)}

USER QUESTION:
${options.message}

Respond with factual platform information only where numbers or statuses are required, then optional general advice.`
}

/** Topics the assistant is allowed to discuss without inventing operational numbers. */
export const assistantTopicHints = [
  'how to prepare a material for recycling',
  'recycling habits',
  'explanation of classifications',
  'interpretation of pickup status',
  'how estimated value was calculated',
  'potential recycling opportunities'
] as const
