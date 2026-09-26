<script setup lang="ts">
const year = new Date().getFullYear()

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'What we take', to: '/#what-you-can-recycle' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Get started', to: '/register' },
      { label: 'Scan materials', to: '/scan' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Who it’s for', to: '/#platform-roles' },
      { label: 'The mission', to: '/#the-mission' },
      { label: 'FAQ', to: '/#faq' },
      { label: 'Our mission', to: '/#the-mission' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create account', to: '/register' },
      { label: 'Workspace', to: '/workspace' },
      { label: 'Analytics', to: '/dashboard/analytics' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/#privacy' },
      { label: 'Terms of use', to: '/#terms' },
      { label: 'Cookies', to: '/#cookies' },
    ],
  },
] as const
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-main">
        <div class="footer-brand">
          <BrandMark />
          <p class="footer-tagline">A little less waste.<br>A lot more possibility.</p>
        </div>

        <nav class="footer-sitemap" aria-label="Footer">
          <div v-for="column in columns" :key="column.title" class="footer-col">
            <h3 class="footer-col-title">{{ column.title }}</h3>
            <ul class="footer-col-list">
              <li v-for="link in column.links" :key="link.label">
                <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div class="footer-bottom">
        <p>© {{ year }} ReCircle. Built for Africa.</p>
      </div>
    </div>
  </footer>
</template>
