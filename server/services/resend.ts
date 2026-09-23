import { Resend } from 'resend'
import { createError } from 'h3'
import { getServerConfig } from '../utils/config'

export async function sendSignupOtpEmail(email: string, code: string): Promise<void> {
  const { resendApiKey, resendFromEmail } = getServerConfig()
  const subject = 'Your ReCircle verification code'
  const text = `Your ReCircle code is ${code}. It expires in 10 minutes.`
  const html = `<p>Your ReCircle code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`

  if (!resendApiKey) {
    if (import.meta.dev) {
      console.warn(
        `[dev] RESEND_API_KEY missing — email skipped. Signup OTP for ${email}: ${code}`
      )
      return
    }
    throw createError({ statusCode: 503, statusMessage: 'Email delivery is not configured' })
  }

  const from = resendFromEmail || 'ReCircle <onboarding@resend.dev>'
  const resend = new Resend(resendApiKey)
  const { error } = await resend.emails.send({ from, to: email, subject, text, html })
  if (error) {
    console.error('[resend] Failed to send signup OTP:', error.message || error)
    throw createError({ statusCode: 502, statusMessage: 'Could not send verification email' })
  }
}
