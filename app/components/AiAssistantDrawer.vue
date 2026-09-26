<script setup lang="ts">
import { formatAssistantReplyHtml } from '~~/utils/ai-assistant'
import type { PickupRequestView } from '../../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const triggerEl = ref<HTMLButtonElement | null>(null)
const message = ref('')
const sending = ref(false)
const errorMessage = ref('')
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: 'Ask about prep steps, classifications, pickup status, or how estimates were calculated. I only answer recycling and ReCircle questions — answers about your activity are based on your account.'
  }
])
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const { user } = useAuth()
const latestRequest = ref<PickupRequestView | null>(null)

const suggestions = [
  'How do I prepare PET for pickup?',
  'How can I earn more?',
  'What does my pickup status mean?',
  'How was estimated value calculated?'
]
const actions = computed(() => {
  if (user.value?.role === 'recycler') return [
    { label: 'Open incoming pickups', to: '/dashboard/recycler' },
    { label: 'Update availability', to: '/dashboard/availability' },
    { label: 'View analytics', to: '/dashboard/analytics' }
  ]
  if (user.value?.role === 'admin') return [
    { label: 'Open admin console', to: '/dashboard/admin' },
    { label: 'Optimize pickups', to: '/dashboard/admin' },
    { label: 'View analytics', to: '/dashboard/analytics' }
  ]
  return [
    ...(latestRequest.value ? [{ label: 'Open latest pickup', to: '/dashboard/user' }] : []),
    { label: 'Scan an item', to: '/scan' },
    { label: 'View history', to: '/dashboard/history' },
    { label: 'Update pickup address', to: '/dashboard/settings' }
  ]
})
onMounted(async () => {
  if (user.value?.role !== 'user') return
  try {
    const result = await $fetch<{ requests: PickupRequestView[] }>('/api/requests')
    latestRequest.value = result.requests.find(entry => !['completed', 'rejected', 'cancelled'].includes(entry.status)) ?? null
  } catch { /* actions remain available without request context */ }
})

function bubbleHtml(entry: ChatMessage) {
  if (entry.role !== 'assistant') return ''
  return formatAssistantReplyHtml(entry.content)
}

watch(open, async (isOpen) => {
  await nextTick()
  if (isOpen) inputEl.value?.focus()
  else triggerEl.value?.focus()
})

watch(messages, async () => {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}, { deep: true })

function toggle() {
  open.value = !open.value
  errorMessage.value = ''
}

function useSuggestion(text: string) {
  message.value = text
  void send()
}

async function send() {
  const text = message.value.trim()
  if (!text || sending.value) return
  errorMessage.value = ''
  messages.value.push({ role: 'user', content: text })
  message.value = ''
  sending.value = true
  try {
    const history = messages.value
      .slice(1, -1)
      .slice(-6)
      .map(entry => ({ role: entry.role, content: entry.content }))
    const result = await $fetch<{ reply: string; disclaimer: string }>('/api/ai-recommendation', {
      method: 'POST',
      body: { message: text, history }
    })
    messages.value.push({ role: 'assistant', content: result.reply })
  } catch (caught: unknown) {
    messages.value.pop()
    message.value = text
    const response = caught && typeof caught === 'object' && 'data' in caught
      ? (caught as { data?: { statusMessage?: string } }).data
      : undefined
    errorMessage.value = response?.statusMessage || 'Could not reach the assistant. Try again.'
  } finally {
    sending.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <div class="ai-assistant">
    <button
      ref="triggerEl"
      class="ai-assistant-fab"
      type="button"
      :aria-expanded="open"
      aria-controls="ai-assistant-drawer"
      @click="toggle"
    >
      <span class="ai-assistant-fab-icon" aria-hidden="true">
        <DashboardIcon :name="open ? 'close' : 'spark'" :tone="open ? 'plain' : 'brand'" />
      </span>
      <span class="ai-assistant-fab-label">{{ open ? 'Close' : 'Ask ReCircle' }}</span>
    </button>

    <aside
      id="ai-assistant-drawer"
      class="ai-assistant-drawer"
      :class="{ 'is-open': open }"
      :aria-hidden="!open"
      :inert="!open"

      aria-label="ReCircle assistant"
      @keydown.esc="open = false"
    >
      <header class="ai-assistant-header">
        <div class="ai-assistant-heading">
          <span class="ai-assistant-heading-icon" aria-hidden="true">
            <DashboardIcon name="spark" tone="brand" />
          </span>
          <div>
            <p class="eyebrow">ReCircle AI</p>
            <h2>Assistant</h2>
          </div>
        </div>
        <button class="icon-button" type="button" aria-label="Close assistant" @click="open = false">
          <AppIcon name="close" :size="18" />
        </button>
      </header>

      <p class="ai-assistant-note muted">
        Get guidance for recycling and ReCircle only — prep, pickups, estimates, and your account activity.
      </p>

      <div ref="listEl" class="ai-assistant-messages" role="log" aria-live="polite">
        <div
          v-for="(entry, index) in messages"
          :key="`${entry.role}-${index}`"
          class="ai-bubble"
          :class="entry.role === 'user' ? 'ai-bubble--user' : 'ai-bubble--assistant'"
        >
          <div v-if="entry.role === 'assistant'" class="ai-reply" v-html="bubbleHtml(entry)" />
          <p v-else>{{ entry.content }}</p>
        </div>
      </div>

      <div class="ai-assistant-suggestions">
        <button
          v-for="hint in suggestions"
          :key="hint"
          type="button"
          class="ai-chip"
          :disabled="sending"
          @click="useSuggestion(hint)"
        >
          {{ hint }}
        </button>
      </div>
      <nav class="ai-assistant-actions" aria-label="Quick actions">
        <NuxtLink v-for="action in actions" :key="action.label" :to="action.to" @click="open = false">{{ action.label }} <AppIcon name="arrow" :size="14" /></NuxtLink>
      </nav>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <form class="ai-assistant-form" @submit.prevent="send">
        <label class="sr-only" for="ai-assistant-input">Message</label>
        <textarea
          id="ai-assistant-input"
          ref="inputEl"
          v-model="message"
          rows="2"
          maxlength="1000"
          placeholder="Ask about prep, habits, status, or estimates…"
          :disabled="sending"
          @keydown="onKeydown"
        />
        <BaseButton type="submit" size="sm" :loading="sending" :disabled="!message.trim()">Send</BaseButton>
      </form>
    </aside>
  </div>
</template>

