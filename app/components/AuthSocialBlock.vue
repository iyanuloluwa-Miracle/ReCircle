<script setup lang="ts">
const socialNotice = ref('')

const primary = { id: 'google', label: 'Continue with Google' } as const
const secondary = [
  { id: 'github', label: 'GitHub' },
  { id: 'apple', label: 'Apple' },
] as const

function onSocial(label: string) {
  socialNotice.value = `${label.replace('Continue with ', '')} sign-in isn’t available in this preview. Continue with email below.`
}
</script>

<template>
  <div class="auth-social" role="group" aria-label="Social sign-in">
    <button class="auth-social-btn auth-social-btn--primary" type="button" @click="onSocial(primary.label)">
      <span class="auth-social-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12Z" />
          <path fill="#34A853" d="M6.6 14.3 5.8 15l-2.5 1.9A9.96 9.96 0 0 0 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1a5.9 5.9 0 0 1-5.4-3.9Z" />
          <path fill="#4A90E2" d="M3.3 7.1A9.96 9.96 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7l3.4-2.6A5.9 5.9 0 0 1 6.1 12c0-.8.2-1.5.5-2.2L3.3 7.1Z" />
          <path fill="#FBBC05" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2a9.96 9.96 0 0 0-8.7 5.1l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z" />
        </svg>
      </span>
      <span>{{ primary.label }}</span>
    </button>

    <div class="auth-social-row">
      <button
        v-for="provider in secondary"
        :key="provider.id"
        class="auth-social-btn"
        type="button"
        @click="onSocial(provider.label)"
      >
        <span class="auth-social-icon" aria-hidden="true">
          <svg v-if="provider.id === 'github'" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.6 9.6 0 0 1 5 0c2-.1 2.8-1 2.8-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M16.4 12.4c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.8 2.1 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.2-2.4-.1 0-2.1-.8-2.1-3.1ZM14.4 6.5c.6-.8 1.1-1.8.9-2.9-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.8-.9 2.8 1.1.1 2.1-.5 2.7-1.4Z" />
          </svg>
        </span>
        <span>{{ provider.label }}</span>
      </button>
    </div>

    <p v-if="socialNotice" class="auth-social-notice" role="status">{{ socialNotice }}</p>
  </div>

  <div class="auth-divider" role="separator">
    <span class="auth-divider-line" aria-hidden="true" />
    <span class="auth-divider-label">Or</span>
    <span class="auth-divider-line" aria-hidden="true" />
  </div>
</template>
