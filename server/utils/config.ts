import { useRuntimeConfig } from '#imports'

/** Unprefixed deployment variables are resolved at runtime, never in the client bundle. */
export function getServerConfig() {
  const config = useRuntimeConfig()
  return {
    mongodbUri: process.env.MONGODB_URI || config.mongodbUri,
    openrouterApiKey: process.env.OPENROUTER_API_KEY || config.openrouterApiKey,
    openrouterModel: process.env.OPENROUTER_MODEL || config.openrouterModel,
    byteshipApiKey: process.env.BYTESHIP_API_KEY || config.byteshipApiKey,
    sessionSecret: process.env.SESSION_SECRET || config.sessionSecret,
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || config.paystackSecretKey,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || config.paystackPublicKey,
    resendApiKey: process.env.RESEND_API_KEY || config.resendApiKey,
    resendFromEmail: process.env.RESEND_FROM_EMAIL || config.resendFromEmail,
    googleClientId: process.env.GOOGLE_CLIENT_ID
      || process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID
      || config.googleClientId
      || config.public.googleClientId
      || ''
  }
}
