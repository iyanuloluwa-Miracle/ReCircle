import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'

const options = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }

function derive(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, 32, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function hashOtp(code: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(code, salt)
  return ['otp-v1', salt, key.toString('hex')].join('$')
}

export async function verifyOtpHash(code: string, storedHash: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const [version, salt, hash, extra] = storedHash.split('$')
  if (version !== 'otp-v1' || !salt || !hash || extra !== undefined
    || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false
  const actual = await derive(code, salt)
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}

export function generateSignupToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSignupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex')
    const right = Buffer.from(b, 'hex')
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const SIGNUP_INTENT_TTL_MS = 30 * 60 * 1000
export const SIGNUP_TOKEN_TTL_MS = 15 * 60 * 1000
