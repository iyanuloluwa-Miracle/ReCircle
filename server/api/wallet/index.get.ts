import { defineEventHandler } from 'h3'
import { getWalletForUser } from '../../services/wallet'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['user', 'recycler', 'admin'])
  return getWalletForUser(user)
})
