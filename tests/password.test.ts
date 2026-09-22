import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from '../server/services/password.ts'

test('password hashes use random salt and verify without accepting wrong passwords', async () => {
  const password = 'a-long-demo-password'
  const first = await hashPassword(password)
  const second = await hashPassword(password)
  assert.notEqual(first, second)
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword('a-different-password', first), false)
  assert.equal(await verifyPassword(password, 'scrypt-v1$invalid$hash'), false)
  assert.equal(await verifyPassword(password, first + '$extra'), false)
})

test('short and excessively long passwords are rejected', async () => {
  await assert.rejects(hashPassword('short'))
  await assert.rejects(hashPassword('a'.repeat(129)))
})
