import { defineEventHandler } from 'h3'
import { listNigerianBanks } from '../../services/paystack'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  await requireSessionUser(event, ['user'])
  const banks = await listNigerianBanks()
  return { banks }
})
