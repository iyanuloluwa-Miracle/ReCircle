/** Fixed emoji avatar allowlist for onboarding (client + server). */
export const AVATAR_EMOJI_PRESETS = [
  '♻️', '🌿', '🌱', '🍃', '🌍', '☀️',
  '🚲', '💧', '🫧', '📦', '🫙', '🪴'
] as const

export type AvatarEmojiPreset = typeof AVATAR_EMOJI_PRESETS[number]

export function emojiAvatarUrl(emoji: string): string {
  return `emoji:${emoji}`
}

export function parseEmojiAvatar(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith('emoji:')) return null
  return avatarUrl.slice('emoji:'.length)
}

export function isAllowedEmojiAvatar(avatarUrl: string): boolean {
  const emoji = parseEmojiAvatar(avatarUrl)
  return emoji !== null && (AVATAR_EMOJI_PRESETS as readonly string[]).includes(emoji)
}
