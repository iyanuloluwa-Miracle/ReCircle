export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  title: string
  message?: string
  tone: ToastTone
}

let nextToastId = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function useToast() {
  const toasts = useState<ToastMessage[]>('recircle-toasts', () => [])

  function dismiss(id: number) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  function show(toast: Omit<ToastMessage, 'id'>, duration = toast.tone === 'error' ? 7000 : 5000) {
    const id = ++nextToastId
    toasts.value = [...toasts.value, { ...toast, id }].slice(-4)
    if (import.meta.client && duration > 0) {
      timers.set(id, setTimeout(() => dismiss(id), duration))
    }
    return id
  }

  return {
    toasts: readonly(toasts),
    dismiss,
    show,
    success: (title: string, message?: string) => show({ tone: 'success', title, message }),
    error: (title: string, message?: string) => show({ tone: 'error', title, message }),
    info: (title: string, message?: string) => show({ tone: 'info', title, message })
  }
}
