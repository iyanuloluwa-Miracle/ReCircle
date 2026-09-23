<script setup lang="ts">
import type { UserRole } from '../../types'

const props = withDefaults(defineProps<{
  mode?: 'login' | 'signup'
  role?: UserRole
  /** When true, divider sits above the Google button (form-first layouts). */
  dividerFirst?: boolean
  dividerLabel?: string
}>(), {
  mode: 'login',
  dividerFirst: false,
  dividerLabel: 'Or continue with email'
})

const emit = defineEmits<{
  success: []
  error: [message: string]
}>()

const auth = useAuth()
const config = useRuntimeConfig()
const pending = ref(false)
const notice = ref('')
const gisHost = ref<HTMLElement | null>(null)
const clientId = computed(() => String(config.public.googleClientId || '').trim())

type CredentialResponse = { credential?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: CredentialResponse) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean
            isSkippedMoment: () => boolean
            isDismissedMoment: () => boolean
          }) => void) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (import.meta.server) return Promise.reject(new Error('GIS is client-only'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGis = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

async function handleCredential(credential: string) {
  await auth.loginWithGoogle(
    credential,
    props.mode === 'signup' ? props.role : undefined
  )
  emit('success')
}

function mapError(error: unknown): string {
  const status = error && typeof error === 'object' && 'statusCode' in error
    ? error.statusCode
    : undefined
  if (status === 400) return 'Choose a role before continuing with Google.'
  if (status === 409) return 'That Google account is already linked another way. Try email sign-in.'
  if (status === 503) return 'Google sign-in isn’t configured yet. Continue with email below.'
  return 'Google sign-in failed. Try again or use email.'
}

async function onGoogle() {
  notice.value = ''
  if (!clientId.value) {
    notice.value = 'Google sign-in isn’t configured yet. Continue with email below.'
    return
  }
  if (props.mode === 'signup' && !props.role) {
    notice.value = 'Choose a role first, then continue with Google.'
    return
  }
  pending.value = true
  try {
    await loadGis()
    const callback = async (response: CredentialResponse) => {
      try {
        if (!response.credential) throw new Error('No credential')
        await handleCredential(response.credential)
      } catch (error) {
        notice.value = mapError(error)
        emit('error', notice.value)
      } finally {
        pending.value = false
      }
    }

    window.google!.accounts.id.initialize({
      client_id: clientId.value,
      cancel_on_tap_outside: true,
      callback
    })

    // Prefer One Tap; if skipped, trigger the official button under the hood.
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        const host = gisHost.value
        if (!host) {
          pending.value = false
          notice.value = 'Google sign-in was cancelled. Try again or use email.'
          return
        }
        host.replaceChildren()
        window.google!.accounts.id.renderButton(host, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 360
        })
        const button = host.querySelector<HTMLElement>('div[role="button"]')
        if (button) button.click()
        else {
          pending.value = false
          notice.value = 'Google sign-in was cancelled. Try again or use email.'
        }
      }
    })
  } catch {
    pending.value = false
    notice.value = 'Google sign-in isn’t available right now. Continue with email below.'
  }
}
</script>

<template>
  <div class="auth-social" role="group" aria-label="Social sign-in">
    <div v-if="dividerFirst" class="auth-divider" role="separator">
      <span class="auth-divider-line" aria-hidden="true" />
      <span class="auth-divider-label">{{ dividerLabel }}</span>
      <span class="auth-divider-line" aria-hidden="true" />
    </div>

    <button
      class="auth-social-btn"
      type="button"
      :disabled="pending"
      :aria-busy="pending || undefined"
      @click="onGoogle"
    >
      <span class="auth-social-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12Z" />
          <path fill="#34A853" d="M6.6 14.3 5.8 15l-2.5 1.9A9.96 9.96 0 0 0 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1a5.9 5.9 0 0 1-5.4-3.9Z" />
          <path fill="#4A90E2" d="M3.3 7.1A9.96 9.96 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7l3.4-2.6A5.9 5.9 0 0 1 6.1 12c0-.8.2-1.5.5-2.2L3.3 7.1Z" />
          <path fill="#FBBC05" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2a9.96 9.96 0 0 0-8.7 5.1l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z" />
        </svg>
      </span>
      <span>{{ pending ? 'Connecting…' : 'Continue with Google' }}</span>
    </button>
    <div ref="gisHost" class="auth-gis-host" aria-hidden="true" />
    <p v-if="notice" class="auth-social-notice" role="status">{{ notice }}</p>

    <div v-if="!dividerFirst" class="auth-divider" role="separator">
      <span class="auth-divider-line" aria-hidden="true" />
      <span class="auth-divider-label">{{ dividerLabel }}</span>
      <span class="auth-divider-line" aria-hidden="true" />
    </div>
  </div>
</template>
