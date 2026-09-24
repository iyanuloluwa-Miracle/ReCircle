<script setup lang="ts">
import { onboardingPathByRole } from '../../../types'
import { onboardingStepsForRole } from '../../../utils/onboarding'
import { AVATAR_PRESETS, isAllowedAvatarPreset } from '../../../utils/avatar-presets'
import { imageExtension, validateImageFile, type ImageMimeType } from '../../../utils/waste-image'

definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const steps = computed(() => onboardingStepsForRole(auth.user.value?.role ?? 'user'))
const current = auth.user.value?.avatarUrl ?? null
const selected = ref<string | null>(
  current && (isAllowedAvatarPreset(current) || current.startsWith('http'))
    ? current
    : null
)
const pending = ref(false)
const uploadPending = ref(false)
const errorMessage = ref('')
const previewUrl = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const previewSrc = computed(() => previewUrl.value || (
  selected.value?.startsWith('http') ? selected.value : null
))

function choosePreset(url: string) {
  selected.value = url
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
    errorMessage.value = 'Photo upload failed. Try again or pick a preset instead.'
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
    if (isAllowedAvatarPreset(selected.value)) {
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
  <AuthSplit title="Choose your avatar." :steps="steps" :current-step="1">
    <div class="avatar-picker">
      <p class="muted auth-hint">Pick a DiceBear preset or upload a photo. Required before you continue.</p>

      <div class="avatar-preview" aria-hidden="true">
        <img v-if="previewSrc" :src="previewSrc" alt="">
        <span v-else class="avatar-emoji avatar-emoji--empty">?</span>
      </div>

      <div class="avatar-grid" role="listbox" aria-label="DiceBear avatar presets">
        <button
          v-for="url in AVATAR_PRESETS"
          :key="url"
          type="button"
          class="avatar-grid-item"
          :class="{ 'is-selected': selected === url }"
          role="option"
          :aria-selected="selected === url"
          :disabled="uploadPending"
          @click="choosePreset(url)"
        >
          <img :src="url" alt="" width="64" height="64" loading="lazy">
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
