<script setup lang="ts">
import type { RequestChatMessageView, RequestChatThreadView } from '../../types'

const POLL_MS = 6_000

const { user } = useAuth()
const {
  requestId,
  title,
  subtitle,
  isOpen,
  closeRequestChat
} = useRequestChat()

const messages = ref<RequestChatMessageView[]>([])
const canSend = ref(false)
const draft = ref('')
const loading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const response = error.data as { statusMessage?: string }
    if (response?.statusMessage) return response.statusMessage
  }
  return fallback
}

function isMine(entry: RequestChatMessageView) {
  return Boolean(user.value && entry.senderUserId === user.value.id)
}

function formatTime(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function loadThread(options?: { incremental?: boolean }) {
  if (!requestId.value) return
  const incremental = options?.incremental ?? false
  if (!incremental) loading.value = true
  errorMessage.value = ''

  try {
    const lastId = incremental ? messages.value.at(-1)?.id : undefined
    const query = lastId ? `?after=${encodeURIComponent(lastId)}` : ''
    const result = await $fetch<RequestChatThreadView>(`/api/requests/${requestId.value}/messages${query}`)
    canSend.value = result.canSend
    if (incremental && lastId) {
      if (result.messages.length) {
        messages.value = [...messages.value, ...result.messages]
        await scrollToBottom()
      }
    } else {
      messages.value = result.messages
      await scrollToBottom()
    }
  } catch (error) {
    if (!incremental) {
      errorMessage.value = friendlyError(error, 'Could not load messages.')
      messages.value = []
      canSend.value = false
    }
  } finally {
    if (!incremental) loading.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  stopPolling()
  if (!import.meta.client) return
  pollTimer = setInterval(() => {
    if (!isOpen.value || sending.value) return
    void loadThread({ incremental: true })
  }, POLL_MS)
}

async function send() {
  const text = draft.value.trim()
  if (!text || !requestId.value || sending.value || !canSend.value) return

  sending.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{
      canSend: boolean
      message: RequestChatMessageView
    }>(`/api/requests/${requestId.value}/messages`, {
      method: 'POST',
      body: { body: text }
    })
    draft.value = ''
    canSend.value = result.canSend
    if (!messages.value.some(entry => entry.id === result.message.id)) {
      messages.value = [...messages.value, result.message]
    }
    await scrollToBottom()
  } catch (error) {
    errorMessage.value = friendlyError(error, 'Could not send message.')
  } finally {
    sending.value = false
    await nextTick()
    inputEl.value?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}

async function close() {
  closeRequestChat()
  const route = useRoute()
  if (route.query.chat) {
    const nextQuery = { ...route.query }
    delete nextQuery.chat
    await navigateTo({ path: route.path, query: nextQuery }, { replace: true })
  }
}

watch(isOpen, async (open) => {
  stopPolling()
  if (!open) {
    messages.value = []
    draft.value = ''
    errorMessage.value = ''
    canSend.value = false
    await nextTick()
    return
  }
  await loadThread()
  startPolling()
  await nextTick()
  if (canSend.value) inputEl.value?.focus()
  else closeBtn.value?.focus()
})

watch(requestId, async (id, previous) => {
  if (!id || id === previous || !isOpen.value) return
  stopPolling()
  messages.value = []
  draft.value = ''
  await loadThread()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="request-chat">
    <div
      v-if="isOpen"
      class="request-chat-backdrop"
      aria-hidden="true"
      @click="close"
    />
    <aside
      id="request-chat-drawer"
      class="request-chat-drawer"
      :class="{ 'is-open': isOpen }"
      :aria-hidden="!isOpen"
      :inert="!isOpen"
      aria-label="Pickup chat"
      @keydown.esc="close"
    >
      <header class="request-chat-header">
        <div class="request-chat-heading">
          <p class="analysis-kicker">Pickup chat</p>
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="muted request-chat-subtitle">{{ subtitle }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="request-chat-close"
          aria-label="Close chat"
          @click="close"
        >
          <DashboardIcon name="close" />
        </button>
      </header>

      <p v-if="loading" class="muted request-chat-status">Loading messages…</p>
      <p v-else-if="!messages.length && !errorMessage" class="muted request-chat-status">
        No messages yet. Coordinate pickup details here.
      </p>

      <div ref="listEl" class="request-chat-messages" role="log" aria-live="polite">
        <div
          v-for="entry in messages"
          :key="entry.id"
          class="request-chat-bubble"
          :class="isMine(entry) ? 'request-chat-bubble--mine' : 'request-chat-bubble--theirs'"
        >
          <p>{{ entry.body }}</p>
          <time v-if="entry.createdAt" :datetime="entry.createdAt">{{ formatTime(entry.createdAt) }}</time>
        </div>
      </div>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <p v-if="!canSend && isOpen && !loading" class="muted request-chat-note">
        This chat is read-only because the pickup is no longer active.
      </p>

      <form v-if="canSend" class="request-chat-form" @submit.prevent="send">
        <label class="sr-only" for="request-chat-input">Message</label>
        <textarea
          id="request-chat-input"
          ref="inputEl"
          v-model="draft"
          rows="2"
          maxlength="1000"
          placeholder="Write a message…"
          :disabled="sending"
          @keydown="onKeydown"
        />
        <BaseButton type="submit" size="sm" :loading="sending" :disabled="!draft.trim()">Send</BaseButton>
      </form>
    </aside>
  </div>
</template>
