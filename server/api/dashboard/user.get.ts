import { defineEventHandler } from 'h3'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => ({ user: await requireSessionUser(event, ['user']) }))
