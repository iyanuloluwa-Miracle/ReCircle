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
    resendApiKey: '',
    resendFromEmail: '',
    googleClientId: '',
    public: {
      appUrl: 'http://localhost:3000',
      googleClientId: ''
    }
  },
  app: {
    head: {
      title: 'ReCircle — A new life for your recyclables',
      meta: [
        { name: 'description', content: 'ReCircle is building a simpler way for Lagos to identify recyclables and coordinate recycling. Explore our hackathon prototype.' },
        { name: 'theme-color', content: '#123f32' }
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/recircle-logo.png' }]
    }
  },
  vite: { plugins: [tailwindcss()] }
})
