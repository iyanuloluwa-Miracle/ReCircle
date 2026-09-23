/** Fixed DiceBear avatar allowlist for onboarding (client + server).
 *  Uses the public HTTP API: https://www.dicebear.com/how-to-use/http-api/
 */
const DICEBEAR_BASE = 'https://api.dicebear.com/10.x/lorelei/svg'

/** Stable seeds + soft brand-adjacent backgrounds for 12 picker presets. */
const PRESET_OPTIONS = [
  { seed: 'Ada', backgroundColor: 'c0e8d5' },
  { seed: 'Kai', backgroundColor: 'd4e8c2' },
  { seed: 'Noa', backgroundColor: 'b8d9c8' },
  { seed: 'Remi', backgroundColor: 'e8f0d8' },
  { seed: 'Sora', backgroundColor: 'c5ddd0' },
  { seed: 'Ife', backgroundColor: 'dcecc8' },
  { seed: 'Zuri', backgroundColor: 'b6e3f4' },
  { seed: 'Amara', backgroundColor: 'c0aede' },
  { seed: 'Tayo', backgroundColor: 'd1d4f9' },
  { seed: 'Nia', backgroundColor: 'ffd5dc' },
  { seed: 'Kofi', backgroundColor: 'ffdfbf' },
  { seed: 'Ayo', backgroundColor: 'c0e8d5' }
] as const

export function dicebearAvatarUrl(seed: string, backgroundColor: string): string {
  const params = new URLSearchParams({
    seed,
    backgroundColor,
    borderRadius: '50'
  })
  return `${DICEBEAR_BASE}?${params.toString()}`
}

export const AVATAR_PRESETS = PRESET_OPTIONS.map(option =>
  dicebearAvatarUrl(option.seed, option.backgroundColor)
)

export type AvatarPreset = typeof AVATAR_PRESETS[number]

export function isAllowedAvatarPreset(avatarUrl: string): boolean {
  return (AVATAR_PRESETS as readonly string[]).includes(avatarUrl)
}
