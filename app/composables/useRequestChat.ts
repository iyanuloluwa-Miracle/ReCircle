export function useRequestChat() {
  const requestId = useState<string | null>('request-chat-id', () => null)
  const title = useState('request-chat-title', () => 'Pickup chat')
  const subtitle = useState('request-chat-subtitle', () => '')

  const isOpen = computed(() => Boolean(requestId.value))

  function openRequestChat(options: { requestId: string; title?: string; subtitle?: string }) {
    requestId.value = options.requestId
    title.value = options.title?.trim() || 'Pickup chat'
    subtitle.value = options.subtitle?.trim() || ''
  }

  function closeRequestChat() {
    requestId.value = null
    title.value = 'Pickup chat'
    subtitle.value = ''
  }

  return {
    requestId,
    title,
    subtitle,
    isOpen,
    openRequestChat,
    closeRequestChat
  }
}
