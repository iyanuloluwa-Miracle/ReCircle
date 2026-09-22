import { createError } from 'h3'
import { z } from 'zod'
import { getOpenRouterTransport } from './openrouter'
import { loadAssistantFacts } from './ai-assistant-context'
import { assistantSystemPrompt, buildGroundedUserPrompt } from '../../utils/ai-assistant'
import type { AuthUser } from '../../types'

const historySchema = z.array(z.strictObject({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000)
})).max(8)

export async function askRecykleAssistant(options: {
  user: AuthUser
  message: string
  wasteItemId?: string
  requestId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}) {
  const facts = await loadAssistantFacts({
    user: options.user,
    wasteItemId: options.wasteItemId,
    requestId: options.requestId
  })

  const history = historySchema.parse(options.history ?? [])
  const transport = getOpenRouterTransport('assistant')

  let response: unknown
  try {
    response = await transport.request({
      messages: [
        { role: 'system', content: assistantSystemPrompt },
        ...history.map(entry => ({ role: entry.role, content: entry.content })),
        { role: 'user', content: buildGroundedUserPrompt({ message: options.message, facts }) }
      ],
      temperature: 0.2,
      max_tokens: 700
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: 'Assistant is unavailable right now' })
  }

  const envelope = z.object({
    choices: z.array(z.object({
      message: z.object({ content: z.string().nullable() })
    })).min(1)
  }).safeParse(response)
  const content = envelope.success ? envelope.data.choices[0]?.message.content?.trim() : ''
  if (!content) throw createError({ statusCode: 502, statusMessage: 'Assistant returned an empty reply' })

  const factsUsed = [
    facts.materialsRecycled.length ? 'materialsRecycled' : null,
    facts.recentItems.length ? 'recentItems' : null,
    facts.recentRequests.length ? 'recentRequests' : null,
    facts.earnings.recentTransactions.length || facts.earnings.totalCompletedPayoutNgn ? 'earnings' : null,
    facts.recyclerPricing.length ? 'recyclerPricing' : null,
    facts.focusedItem ? 'focusedItem' : null,
    facts.focusedRequest ? 'focusedRequest' : null
  ].filter((value): value is string => Boolean(value))

  return {
    reply: content,
    factsUsed,
    disclaimer: 'Numbers and statuses come from your Recykle MongoDB records. General recycling tips are advice only and do not change your data.',
    role: facts.role
  }
}
