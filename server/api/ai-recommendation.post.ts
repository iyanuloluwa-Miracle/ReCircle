import { defineEventHandler } from 'h3'
import { Types } from 'mongoose'
import { z } from 'zod'
import { askRecykleAssistant } from '../services/ai-assistant'
import { assertSameOrigin } from '../utils/origin'
import { requireSessionUser } from '../utils/session'
import { readValidatedJson } from '../utils/validation'

const bodySchema = z.strictObject({
  message: z.string().trim().min(2).max(1000),
  wasteItemId: z.string().refine(value => Types.ObjectId.isValid(value)).optional(),
  requestId: z.string().refine(value => Types.ObjectId.isValid(value)).optional(),
  history: z.array(z.strictObject({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000)
  })).max(8).optional()
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['user', 'recycler', 'waste_operator'])
  const body = await readValidatedJson(event, bodySchema)
  return askRecykleAssistant({
    user,
    message: body.message,
    wasteItemId: body.wasteItemId,
    requestId: body.requestId,
    history: body.history
  })
})
