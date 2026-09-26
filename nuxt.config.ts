import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  debug: false,
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  typescript: { strict: true },
  runtimeConfig: {
    mongodbUri: '',
    openrouterApiKey: '',
    openrouterModel: '',
    byteshipApiKey: '',
    sessionSecret: '',
    paystackSecretKey: '',
    paystackPublicKey: '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
    googleClientId: '',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.NUXT_GOOGLE_MAPS_API_KEY || '',
    public: {
      appUrl: 'http://localhost:3000',
      googleClientId: '',
      // Browser Maps JS + Places. Must be NUXT_PUBLIC_* so it reaches the client.
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    }
  },
  app: {
    head: {
      title: 'ReCircle — A new life for your recyclables',
      meta: [
        { name: 'description', content: 'ReCircle helps Africa identify recyclables, estimate their value, and coordinate pickup with recyclers and waste operators.' },
        { name: 'theme-color', content: '#123f32' }
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/recircle-logo.png' }]
    }
  },
  vite: {
    plugins: [tailwindcss()],
    // OneDrive on Windows can briefly lock files during sync and trip Vite HMR with EBUSY.
    server: {
      watch: {
        usePolling: true,
        interval: 400
      }
    }
  }
})
