<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  length?: number
  disabled?: boolean
  id?: string
}>(), {
  modelValue: '',
  length: 6,
  disabled: false,
  id: 'otp'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: [value: string]
}>()

const digits = ref<string[]>(Array.from({ length: props.length }, () => ''))
const inputs = ref<HTMLInputElement[]>([])

watch(() => props.modelValue, (value) => {
  const next = String(value ?? '').replace(/\D/g, '').slice(0, props.length).split('')
  digits.value = Array.from({ length: props.length }, (_, index) => next[index] ?? '')
}, { immediate: true })

function sync() {
  const value = digits.value.join('')
  emit('update:modelValue', value)
  if (value.length === props.length) emit('complete', value)
}

function setDigit(index: number, char: string) {
  const digit = char.replace(/\D/g, '').slice(-1)
  digits.value[index] = digit
  sync()
  if (digit && index < props.length - 1) inputs.value[index + 1]?.focus()
}

function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value.replace(/\D/g, '')
  if (raw.length > 1) {
    applyPaste(raw, index)
    return
  }
  setDigit(index, raw)
  target.value = digits.value[index]
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    event.preventDefault()
    if (digits.value[index]) {
      digits.value[index] = ''
      sync()
      return
    }
    if (index > 0) {
      digits.value[index - 1] = ''
      sync()
      inputs.value[index - 1]?.focus()
    }
    return
  }
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    inputs.value[index - 1]?.focus()
  }
  if (event.key === 'ArrowRight' && index < props.length - 1) {
    event.preventDefault()
    inputs.value[index + 1]?.focus()
  }
}

function applyPaste(raw: string, startIndex = 0) {
  const chars = raw.replace(/\D/g, '').slice(0, props.length - startIndex).split('')
  if (!chars.length) return
  for (let offset = 0; offset < props.length - startIndex; offset += 1) {
    digits.value[startIndex + offset] = chars[offset] ?? ''
  }
  sync()
  const focusIndex = Math.min(startIndex + chars.length, props.length - 1)
  inputs.value[focusIndex]?.focus()
}

function onPaste(index: number, event: ClipboardEvent) {
  event.preventDefault()
  applyPaste(event.clipboardData?.getData('text') ?? '', index)
}

function setInputRef(el: unknown, index: number) {
  if (el instanceof HTMLInputElement) inputs.value[index] = el
}

function onFocus(event: FocusEvent) {
  const target = event.target
  if (target instanceof HTMLInputElement) target.select()
}
</script>

<template>
  <div class="auth-otp" role="group" :aria-label="`Enter ${length}-digit verification code`">
    <input
      v-for="(_, index) in length"
      :id="index === 0 ? id : undefined"
      :key="index"
      :ref="el => setInputRef(el, index)"
      class="auth-otp-box"
      type="text"
      inputmode="numeric"
      pattern="\d*"
      maxlength="1"
      :value="digits[index]"
      :disabled="disabled"
      :autocomplete="index === 0 ? 'one-time-code' : 'off'"
      :aria-label="`Digit ${index + 1} of ${length}`"
      @input="onInput(index, $event)"
      @keydown="onKeydown(index, $event)"
      @paste="onPaste(index, $event)"
      @focus="onFocus"
    >
  </div>
</template>
