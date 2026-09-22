import { defineEventHandler } from 'h3'
import type { AuthResponse } from '../../../types'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  return { user: await requireSessionUser(event) }
})
