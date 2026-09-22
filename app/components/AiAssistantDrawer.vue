<script setup lang="ts">
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const message = ref('')
const sending = ref(false)
const errorMessage = ref('')
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: 'Ask about prep steps, classifications, pickup status, or how estimates were calculated. Money and status answers use your MongoDB records only.'
  }
])
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const suggestions = [
  'How do I prepare PET for pickup?',
  'How can I earn more?',
  'What does my pickup status mean?',
  'How was estimated value calculated?'
]

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  inputEl.value?.focus()
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
      class="ai-assistant-fab"
      type="button"
      :aria-expanded="open"
      aria-controls="ai-assistant-drawer"
      @click="toggle"
    >
      {{ open ? 'Close' : 'Ask Recykle AI' }}
    </button>

    <aside
      id="ai-assistant-drawer"
      class="ai-assistant-drawer"
      :class="{ 'is-open': open }"
      :aria-hidden="!open"
      aria-label="Recykle AI assistant"
    >
      <header class="ai-assistant-header">
        <div>
          <p class="eyebrow">Recykle AI</p>
          <h2>Assistant</h2>
        </div>
        <button class="icon-button" type="button" aria-label="Close assistant" @click="open = false">×</button>
      </header>

      <p class="ai-assistant-note muted">
        Facts (pricing, earnings, status, distance, confidence) come from MongoDB. Advice is general and does not change your data.
      </p>

      <div ref="listEl" class="ai-assistant-messages" role="log" aria-live="polite">
        <div
          v-for="(entry, index) in messages"
          :key="`${entry.role}-${index}`"
          class="ai-bubble"
          :class="entry.role === 'user' ? 'ai-bubble--user' : 'ai-bubble--assistant'"
        >
          <p>{{ entry.content }}</p>
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
