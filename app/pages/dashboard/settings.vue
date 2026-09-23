<script setup lang="ts">
import type { UserRole } from '../../../types'
import { AVATAR_PRESETS, isAllowedAvatarPreset } from '../../../utils/avatar-presets'
import { formatPickupArea } from '../../../utils/dashboard-metrics'
import { imageExtension, validateImageFile, type ImageMimeType } from '../../../utils/waste-image'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Settings — ReCircle', robots: 'noindex' })

const auth = useAuth()
const { user } = auth
const pickup = usePickupLocation()
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

const current = user.value?.avatarUrl ?? null
const selected = ref<string | null>(
  current && (isAllowedAvatarPreset(current) || current.startsWith('http'))
    ? current
    : null
)
const avatarPending = ref(false)
const uploadPending = ref(false)
const avatarError = ref('')
const avatarSuccess = ref('')
const previewUrl = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const roleLabel: Record<UserRole, string> = {
  user: 'Consumer',
  recycler: 'Recycler',
  waste_operator: 'Waste operator'
}

const currentArea = computed(() => formatPickupArea(user.value?.location))
const previewSrc = computed(() => previewUrl.value || (
  selected.value?.startsWith('http') ? selected.value : null
))
const avatarDirty = computed(() => {
  const currentAvatar = user.value?.avatarUrl ?? null
  return Boolean(selected.value) && selected.value !== currentAvatar
})

function choosePreset(url: string) {
  selected.value = url
  avatarError.value = ''
  avatarSuccess.value = ''
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
    avatarError.value = invalid
    return
  }
  uploadPending.value = true
  avatarError.value = ''
  avatarSuccess.value = ''
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
    const result = await $fetch<{ user: typeof user.value }>('/api/profile/avatar', {
      method: 'PATCH',
      body: { filePath: path }
    })
    auth.user.value = result.user
    selected.value = result.user?.avatarUrl ?? null
    avatarSuccess.value = 'Profile photo updated.'
  } catch {
    avatarError.value = 'Photo upload failed. Try again or pick a preset instead.'
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  } finally {
    uploadPending.value = false
  }
}

async function saveAvatar() {
  if (!selected.value || avatarPending.value || uploadPending.value) return
  if (!isAllowedAvatarPreset(selected.value)) {
    avatarError.value = 'Choose a preset or upload a photo.'
    return
  }
  avatarPending.value = true
  avatarError.value = ''
  avatarSuccess.value = ''
  try {
    const result = await $fetch<{ user: typeof user.value }>('/api/profile/avatar', {
      method: 'PATCH',
      body: { avatarUrl: selected.value }
    })
    auth.user.value = result.user
    avatarSuccess.value = 'Avatar updated.'
  } catch {
    avatarError.value = 'Could not save your avatar. Try again.'
  } finally {
    avatarPending.value = false
  }
}

async function savePickupAddress() {
  saveError.value = ''
  saveSuccess.value = ''
  await pickup.useAddressLocation()
  if (pickup.error.value || !pickup.location.value) {
    saveError.value = pickup.error.value || 'Choose a pickup address first.'
    return
  }
  saving.value = true
  try {
    const result = await $fetch<{ user: typeof user.value }>('/api/profile/location', {
      method: 'PATCH',
      body: { location: pickup.location.value }
    })
    auth.user.value = result.user
    saveSuccess.value = `Pickup area updated to ${pickup.label.value}.`
  } catch {
    saveError.value = 'Could not save your pickup location. Try again.'
  } finally {
    saving.value = false
  }
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div class="dash-hero-copy">
        <p class="eyebrow">Account</p>
        <h1 class="page-title">Settings.</h1>
        <p class="muted workspace-intro">
          Update your avatar
          <template v-if="user?.role === 'user'">, review account details, and set your default pickup address</template>
          <template v-else> and review your account details</template>.
        </p>
      </div>
    </div>

    <DashboardSection title="Avatar" description="Pick a DiceBear preset or upload a photo.">
      <div class="settings-avatar">
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
            :disabled="uploadPending || avatarPending"
            @click="choosePreset(url)"
          >
            <img :src="url" alt="" width="64" height="64" loading="lazy">
          </button>
        </div>

        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          @change="onFileChange"
        >

        <div class="settings-avatar-actions">
          <BaseButton
            variant="secondary"
            :loading="uploadPending"
            :disabled="uploadPending || avatarPending"
            @click="fileInput?.click()"
          >
            Upload a photo
          </BaseButton>
          <BaseButton
            :loading="avatarPending"
            :disabled="avatarPending || uploadPending || !avatarDirty || !isAllowedAvatarPreset(selected || '')"
            @click="saveAvatar"
          >
            Save avatar
          </BaseButton>
        </div>

        <p v-if="avatarError" class="form-error" role="alert">{{ avatarError }}</p>
        <p v-else-if="avatarSuccess" class="settings-success" role="status">{{ avatarSuccess }}</p>
      </div>
    </DashboardSection>

    <DashboardSection title="Account" description="These details come from your ReCircle profile.">
      <dl v-if="user" class="settings-dl">
        <div>
          <dt>Name</dt>
          <dd>{{ user.name }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ user.email }}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{{ roleLabel[user.role] }}</dd>
        </div>
        <div v-if="user.isDemo">
          <dt>Account type</dt>
          <dd>Demo account</dd>
        </div>
      </dl>
    </DashboardSection>

    <DashboardSection
      v-if="user?.role === 'user'"
      title="Default pickup location"
      description="Used when you start a new scan. You can still change location per scan."
    >
      <p class="muted settings-current">Current area: <strong>{{ currentArea }}</strong></p>
      <p v-if="pickup.label.value && pickup.location.value" class="location-status">{{ pickup.label.value }}</p>
      <form class="auth-form settings-form" @submit.prevent="savePickupAddress">
        <label for="settings-address">Address</label>
        <input
          id="settings-address"
          v-model="pickup.address.value"
          type="text"
          autocomplete="street-address"
          placeholder="12 Admiralty Way, Lekki, Lagos"
        >
        <p v-if="saveError || pickup.error.value" class="form-error" role="alert">
          {{ saveError || pickup.error.value }}
        </p>
        <p v-else-if="saveSuccess" class="settings-success" role="status">{{ saveSuccess }}</p>
        <BaseButton
          type="submit"
          :loading="saving || pickup.pending.value"
          :disabled="saving || pickup.pending.value"
        >
          Save pickup location
        </BaseButton>
      </form>
    </DashboardSection>

    <DashboardSection
      v-else
      title="Workspace preferences"
      description="Account details for your role are shown above. More preference controls will land here later."
    >
      <p class="muted">No editable location settings for this role yet.</p>
    </DashboardSection>
  </div>
</template>

<style scoped>
.settings-dl {
  display: grid;
  gap: 1rem;
  margin: 0;
}
.settings-dl > div {
  display: grid;
  gap: .25rem;
}
.settings-dl dt {
  font-size: .7rem;
  font-weight: 650;
  letter-spacing: .02em;
  color: #657269;
}
.settings-dl dd {
  margin: 0;
  font-size: .9375rem;
  font-weight: 600;
  color: #123f32;
}
.settings-current {
  margin: 0 0 .85rem;
  font-size: .8125rem;
}
.settings-form {
  max-width: 24rem;
}
.settings-success {
  margin: .35rem 0 0;
  font-size: .8125rem;
  color: #3d6b2f;
}
.location-status {
  margin: 0 0 .75rem;
  font-size: .8125rem;
  font-weight: 650;
  color: #123f32;
}
.settings-avatar {
  display: grid;
  gap: 1rem;
  justify-items: start;
}
.settings-avatar .avatar-preview {
  width: 5.5rem;
  height: 5.5rem;
}
.settings-avatar .avatar-grid {
  max-width: 28rem;
}
.settings-avatar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .65rem;
}
</style>
