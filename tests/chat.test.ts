import assert from 'node:assert/strict'
import test from 'node:test'
import { canSendChatMessage } from '../utils/chat.ts'

test('chat can send only while pickup is pending, accepted, or picked_up', () => {
  assert.equal(canSendChatMessage('pending'), true)
  assert.equal(canSendChatMessage('accepted'), true)
  assert.equal(canSendChatMessage('picked_up'), true)
  assert.equal(canSendChatMessage('completed'), false)
  assert.equal(canSendChatMessage('rejected'), false)
  assert.equal(canSendChatMessage('cancelled'), false)
})
