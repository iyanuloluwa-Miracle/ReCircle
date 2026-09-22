<script setup lang="ts">
import { AVATAR_EMOJI_PRESETS, emojiAvatarUrl, parseEmojiAvatar } from '../../../utils/avatar-presets'
import { imageExtension, validateImageFile, type ImageMimeType } from '../../../utils/waste-image'
import { onboardingPathByRole } from '../../../types'

definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const selected = ref<string | null>(parseEmojiAvatar(auth.user.value?.avatarUrl ?? null)
  ? auth.user.value!.avatarUrl
  : auth.user.value?.avatarUrl?.startsWith('http') ? auth.user.value.avatarUrl : null)
const pending = ref(false)
const uploadPending = ref(false)
const errorMessage = ref('')
const previewUrl = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

async function chooseEmoji(emoji: string) {
  selected.value = emojiAvatarUrl(emoji)
  errorMessage.value = ''
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploadPending.value) return
  const invalid = await validateImageFile(file)
  if (invalid) {
    errorMessage.value = invalid
    return
  }
  uploadPending.value = true
  errorMessage.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  try {
    const token = await $fetch<{ token: string; folder: string; uploadId: string }>('/api/avatar-upload-token', {
      method: 'POST'
    })
    const path = `${token.folder}/${token.uploadId}.${imageExtension(file.type as ImageMimeType)}`
    const { ByteshipClient } = await import('@byteship/js')
    const byteship = new ByteshipClient({ uploadToken: token.token })
    const uploaded = await byteship.upload(file, { path, visibility: 'public' })
    if (uploaded.status !== 'ready' || !uploaded.url || uploaded.path !== path) {
      throw new Error('Upload incomplete')
    }
    const result = await $fetch<{ user: { avatarUrl: string | null } }>('/api/profile/avatar', {
      method: 'PATCH', body: { filePath: path }
    })
    selected.value = result.user.avatarUrl
    auth.user.value = { ...auth.user.value!, avatarUrl: result.user.avatarUrl }
  } catch {
    errorMessage.value = 'Photo upload failed. Try again or pick an emoji instead.'
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  } finally {
    uploadPending.value = false
  }
}

async function continueOnboarding() {
  if (!selected.value || pending.value || uploadPending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    if (selected.value.startsWith('emoji:')) {
      const result = await $fetch<{ user: typeof auth.user.value }>('/api/profile/avatar', {
        method: 'PATCH', body: { avatarUrl: selected.value }
      })
      auth.user.value = result.user
    }
    const user = auth.user.value
    if (!user?.avatarUrl) {
      errorMessage.value = 'Choose an avatar to continue.'
      return
    }
    await navigateTo(onboardingPathByRole[user.role])
  } catch {
    errorMessage.value = 'Could not save your avatar. Try again.'
  } finally {
    pending.value = false
  }
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

useSeoMeta({ title: 'Choose your avatar — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit title="Choose your avatar.">
    <div class="avatar-picker">
      <p class="muted auth-hint">Pick a preset or upload a photo. Required before you continue.</p>

      <div class="avatar-preview" aria-hidden="true">
        <img v-if="previewUrl || (selected && selected.startsWith('http'))" :src="previewUrl || selected!" alt="">
        <span v-else-if="selected?.startsWith('emoji:')" class="avatar-emoji">{{ selected.slice(6) }}</span>
        <span v-else class="avatar-emoji avatar-emoji--empty">?</span>
      </div>

      <div class="avatar-grid" role="listbox" aria-label="Emoji avatars">
        <button
          v-for="emoji in AVATAR_EMOJI_PRESETS"
          :key="emoji"
          type="button"
          class="avatar-grid-item"
          :class="{ 'is-selected': selected === emojiAvatarUrl(emoji) }"
          role="option"
          :aria-selected="selected === emojiAvatarUrl(emoji)"
          :disabled="uploadPending"
          @click="chooseEmoji(emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <input ref="fileInput" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange">
      <BaseButton
        variant="secondary"
        :loading="uploadPending"
        :disabled="uploadPending"
        @click="fileInput?.click()"
      >
        Upload a photo
      </BaseButton>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton
        :loading="pending"
        :disabled="pending || uploadPending || !selected"
        @click="continueOnboarding"
      >
        Continue
      </BaseButton>
    </div>
  </AuthSplit>
</template>
