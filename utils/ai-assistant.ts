export interface AssistantFactBundle {
  role: 'user' | 'recycler' | 'admin'
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

export const assistantSystemPrompt = `You are the ReCircle Assistant for an Africa recycling coordination platform.

You receive a FACTS JSON block from MongoDB. Those facts are authoritative.
You MUST NOT invent, guess, or change:
- recycler pricing
- pickup availability
- the user's earnings
- transaction status
- recycler distance
- classification confidence
- estimated values or weight

Scope (strict):
- ONLY answer questions about recycling, waste materials, preparation for pickup, ReCircle pickups and statuses, recyclers, estimates/earnings from recycling, classifications, and how to use ReCircle.
- If the user asks about anything outside recycling or ReCircle (sports, news, politics, coding, homework, other apps, general chat, etc.), do NOT answer that topic. Reply briefly that you only help with recycling and ReCircle, then invite a recycling-related question.
- Never provide medical, legal, investment, or unrelated advice.

Rules:
1. When citing numbers (NGN, km, kg, confidence, status), use ONLY values present in FACTS.
2. Clearly separate sections when helpful:
   - "From your ReCircle data:" for database facts
   - "General recycling advice:" for non-financial habits/prep guidance
3. If FACTS lack a number the user asks for, say the platform does not have that recorded yet.
4. Never claim you modified any record. You explain only.
5. Demo recycler prices are invented demo values — say they are demo/platform prices when discussing money.
6. Keep answers concise and practical for mobile chat.
7. Formatting: do NOT use Markdown markers such as **, __, #, or backticks. Write plain text. Put section labels on their own line ending with a colon. Use a single hyphen and space ("- ") for each bullet.`

/** Escape HTML, then light-format assistant replies for safe chat display. */
export function formatAssistantReplyHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const withInline = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = withInline.split(/\r?\n/)
  const parts: string[] = []
  let inList = false

  const closeList = () => {
    if (!inList) return
    parts.push('</ul>')
    inList = false
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }
    const bullet = trimmed.match(/^[-•]\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        parts.push('<ul>')
        inList = true
      }
      parts.push(`<li>${bullet[1]}</li>`)
      continue
    }
    closeList()
    const isHeading = /:$/.test(trimmed) && trimmed.length < 80 && !trimmed.includes('. ')
    parts.push(isHeading ? `<p class="ai-reply-heading">${trimmed}</p>` : `<p>${trimmed}</p>`)
  }
  closeList()
  return parts.join('')
}

/** Build the user message that grounds the model on MongoDB facts. */
export function buildGroundedUserPrompt(options: {
  message: string
  facts: AssistantFactBundle
}) {
  return `FACTS (MongoDB, do not invent beyond this JSON):
${JSON.stringify(options.facts, null, 2)}

USER QUESTION:
${options.message}

If the question is outside recycling or ReCircle, refuse briefly and steer back to recycling. Otherwise respond with factual platform information only where numbers or statuses are required, then optional general recycling advice. Use plain text only — no Markdown asterisks.`
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
