import { createError } from 'h3'
import { OAuth2Client } from 'google-auth-library'
import { getServerConfig } from '../utils/config'

export interface GoogleIdentity {
  googleId: string
  email: string
  name: string
  emailVerified: boolean
  picture: string | null
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const { googleClientId } = getServerConfig()
  if (!googleClientId) {
    throw createError({ statusCode: 503, statusMessage: 'Google sign-in is not configured' })
  }

  const client = new OAuth2Client(googleClientId)
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: googleClientId })
    payload = ticket.getPayload()
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Google credential' })
  }

  if (!payload?.sub || !payload.email) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Google credential' })
  }
  if (payload.email_verified !== true) {
    throw createError({ statusCode: 401, statusMessage: 'Google email is not verified' })
  }

  const name = (payload.name || payload.email.split('@')[0] || 'ReCircle user').trim().slice(0, 120)
  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: name.length >= 2 ? name : 'ReCircle user',
    emailVerified: true,
    picture: typeof payload.picture === 'string' ? payload.picture : null
  }
}
