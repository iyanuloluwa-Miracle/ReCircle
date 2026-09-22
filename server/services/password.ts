import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const passwordSchema = z.string().min(12).max(128)
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  passwordSchema.parse(password)
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt)
  return ['scrypt-v1', salt, key.toString('hex')].join('$')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!passwordSchema.safeParse(password).success) return false
  const [version, salt, hash, extra] = storedHash.split('$')
  if (version !== 'scrypt-v1' || !salt || !hash || extra !== undefined
    || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false
  const actual = await derive(password, salt)
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}
