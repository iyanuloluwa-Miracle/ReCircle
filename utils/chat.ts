import type { RequestStatus } from './request-lifecycle'

export const chatSendableStatuses: readonly RequestStatus[] = ['pending', 'accepted', 'picked_up']

export function canSendChatMessage(status: RequestStatus) {
  return chatSendableStatuses.includes(status)
}
