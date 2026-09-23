import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import type { AuthResponse } from '../../../types'
import { isAllowedAvatarPreset } from '../../../utils/avatar-presets'
import { User } from '../../models/User'
import { toAuthUser } from '../../services/auth'
import { verifyReadyAvatarImage } from '../../services/avatar-upload'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const avatarBodySchema = z.strictObject({
  avatarUrl: z.string().min(1).max(500).optional(),
  filePath: z.string().min(1).max(200).optional()
}).refine(data => Boolean(data.avatarUrl) !== Boolean(data.filePath), {
  message: 'Provide either avatarUrl or filePath'
})

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  assertSameOrigin(event)
  const sessionUser = await requireSessionUser(event)
  const body = await readValidatedJson(event, avatarBodySchema)
  await connectDatabase()

  let avatarUrl: string
  if (body.avatarUrl) {
    if (!isAllowedAvatarPreset(body.avatarUrl)) {
      throw createError({ statusCode: 400, statusMessage: 'Avatar preset is not allowed' })
    }
    avatarUrl = body.avatarUrl
  } else {
    avatarUrl = await verifyReadyAvatarImage(body.filePath!, sessionUser.id)
  }

  const user = await User.findByIdAndUpdate(
    sessionUser.id,
    { $set: { avatarUrl } },
    { new: true }
  )
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  return { user: toAuthUser(user) }
})
