import assert from 'node:assert/strict'
import test from 'node:test'
import { AVATAR_EMOJI_PRESETS, emojiAvatarUrl, isAllowedEmojiAvatar } from '../utils/avatar-presets.ts'
import { generateOtpCode, hashOtp, verifyOtpHash } from '../server/services/otp.ts'

test('avatar presets are allowlisted emoji URLs', () => {
  assert.equal(AVATAR_EMOJI_PRESETS.length, 12)
  assert.equal(isAllowedEmojiAvatar(emojiAvatarUrl('♻️')), true)
  assert.equal(isAllowedEmojiAvatar('emoji:👾'), false)
  assert.equal(isAllowedEmojiAvatar('https://cdn.byteship.cloud/x.jpg'), false)
})

test('otp hashes verify and reject wrong codes', async () => {
  const code = generateOtpCode()
  assert.match(code, /^\d{6}$/)
  const stored = await hashOtp(code)
  assert.equal(await verifyOtpHash(code, stored), true)
  assert.equal(await verifyOtpHash('000000' === code ? '000001' : '000000', stored), false)
})

test('google-only users validate without a password hash', async () => {
  const { User } = await import('../server/models/User.ts')
  const user = new User({
    name: 'Google User',
    email: 'google-user@example.invalid',
    googleId: 'google-sub-123',
    passwordHash: null,
    role: 'user',
    emailVerified: true
  })
  assert.equal(await user.validate(), undefined)
  const passwordOnly = new User({
    name: 'Password User',
    email: 'password-user@example.invalid',
    role: 'user',
    emailVerified: true
  })
  await assert.rejects(passwordOnly.validate())
})
