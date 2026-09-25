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
const toast = useToast()

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
  admin: 'Admin'
}

const currentArea = computed(() => formatPickupArea(user.value?.location))
const previewSrc = computed(() => previewUrl.value || (
  selected.value?.startsWith('http') ? selected.value : null
))
const avatarDirty = computed(() => {
  const currentAvatar = user.value?.avatarUrl ?? null
  return Boolean(selected.value) && selected.value !== currentAvatar
})

const payoutBankCode = ref('')
const payoutAccountNumber = ref('')
const payoutAccountName = ref<string | null>(null)
const payoutHasRecipient = ref(false)
const payoutBanks = ref<Array<{ name: string; code: string }>>([])
const payoutLoading = ref(false)
const payoutSaving = ref(false)
const payoutError = ref('')
const payoutSuccess = ref('')

const businessName = ref('')
const businessNameLoading = ref(false)
const businessNameSaving = ref(false)
const businessNameError = ref('')
const businessNameSuccess = ref('')

async function loadBusinessProfile() {
  if (user.value?.role !== 'recycler') return
  businessNameLoading.value = true
  businessNameError.value = ''
  try {
    const profile = await $fetch<{ businessName: string }>('/api/recycler/profile')
    businessName.value = profile.businessName
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? (error.data as { statusMessage?: string })?.statusMessage
      : undefined
    businessNameError.value = message || 'Could not load your business profile.'
  } finally {
    businessNameLoading.value = false
  }
}

async function saveBusinessName() {
  businessNameError.value = ''
  businessNameSuccess.value = ''
  const nextName = businessName.value.trim()
  if (nextName.length < 2) {
    businessNameError.value = 'Business name must be at least 2 characters.'
    toast.error('Business name too short', businessNameError.value)
    return
  }
  businessNameSaving.value = true
  try {
    const result = await $fetch<{ ok: boolean; businessName: string }>('/api/recycler/profile', {
      method: 'PATCH',
      body: { businessName: nextName }
    })
    businessName.value = result.businessName
    businessNameSuccess.value = 'Business name updated. Consumers will see this name on matches and requests.'
    toast.success('Business name updated')
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? (error.data as { statusMessage?: string })?.statusMessage
      : undefined
    businessNameError.value = message || 'Could not update your business name.'
    toast.error('Could not update business name', businessNameError.value)
  } finally {
    businessNameSaving.value = false
  }
}

async function loadPayoutSettings() {
  if (user.value?.role !== 'user') return
  payoutLoading.value = true
  payoutError.value = ''
  try {
    const [banksRes, payoutRes] = await Promise.all([
      $fetch<{ banks: Array<{ name: string; code: string }> }>('/api/paystack/banks').catch(() => ({ banks: [] as Array<{ name: string; code: string }> })),
      $fetch<{ payout: { bankCode: string | null; accountNumber: string | null; accountName: string | null; hasRecipient: boolean } }>('/api/profile/payout')
    ])
    payoutBanks.value = banksRes.banks
    payoutBankCode.value = payoutRes.payout.bankCode ?? ''
    payoutAccountNumber.value = payoutRes.payout.accountNumber ?? ''
    payoutAccountName.value = payoutRes.payout.accountName
    payoutHasRecipient.value = payoutRes.payout.hasRecipient
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? (error.data as { statusMessage?: string })?.statusMessage
      : undefined
    payoutError.value = message || 'Could not load payout settings. Add Paystack TEST keys to enable bank payouts.'
  } finally {
    payoutLoading.value = false
  }
}

async function savePayoutDetails() {
  payoutError.value = ''
  payoutSuccess.value = ''
  if (!/^\d{10}$/.test(payoutAccountNumber.value.trim())) {
    payoutError.value = 'Enter a valid 10-digit NUBAN account number.'
    toast.error('Invalid account number', payoutError.value)
    return
  }
  if (!payoutBankCode.value) {
    payoutError.value = 'Choose your bank.'
    toast.error('Bank required', payoutError.value)
    return
  }
  payoutSaving.value = true
  try {
    const result = await $fetch<{ payout: { bankCode: string | null; accountNumber: string | null; accountName: string | null; hasRecipient: boolean } }>('/api/profile/payout', {
      method: 'PATCH',
      body: {
        bankCode: payoutBankCode.value,
        accountNumber: payoutAccountNumber.value.trim()
      }
    })
    payoutBankCode.value = result.payout.bankCode ?? ''
    payoutAccountNumber.value = result.payout.accountNumber ?? ''
    payoutAccountName.value = result.payout.accountName
    payoutHasRecipient.value = result.payout.hasRecipient
    payoutSuccess.value = result.payout.hasRecipient
      ? `Payout account saved for ${result.payout.accountName || 'your account'}.`
      : 'Payout details saved.'
    toast.success('Payout account saved', result.payout.accountName || undefined)
  } catch (error) {
    const message = error && typeof error === 'object' && 'data' in error
      ? (error.data as { statusMessage?: string })?.statusMessage
      : undefined
    payoutError.value = message || 'Could not save payout details. Check the account number and try again.'
    toast.error('Could not save payout details', payoutError.value)
  } finally {
    payoutSaving.value = false
  }
}

onMounted(() => {
  void loadPayoutSettings()
  void loadBusinessProfile()
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
    toast.success('Profile photo updated')
  } catch {
    avatarError.value = 'Photo upload failed. Try again or pick a preset instead.'
    toast.error('Photo upload failed', avatarError.value)
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
    toast.success('Avatar updated')
  } catch {
    avatarError.value = 'Could not save your avatar. Try again.'
    toast.error('Could not save avatar', avatarError.value)
  } finally {
    avatarPending.value = false
  }
}

async function savePickupAddress() {
  saveError.value = ''
  saveSuccess.value = ''
  if (pickup.error.value || !pickup.location.value) {
    saveError.value = pickup.error.value || 'Choose a pickup address first.'
    toast.error('Pickup address needed', saveError.value)
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
    toast.success('Pickup area updated', pickup.label.value)
  } catch {
    saveError.value = 'Could not save your pickup location. Try again.'
    toast.error('Could not save pickup area', saveError.value)
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
          <template v-else-if="user?.role === 'recycler'">, review account details, and update your business name</template>
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
      <form class="settings-form" @submit.prevent="savePickupAddress">
        <PlacePicker
          input-id="settings-address"
          :location="pickup.location.value"
          :label="pickup.label.value"
          :disabled="saving || pickup.pending.value"
          placeholder="12 Admiralty Way, Lekki, Lagos"
          @select="({ location, label }) => pickup.setPlace(location, label, 'manual')"
        />
        <p v-if="saveError || pickup.error.value" class="form-error" role="alert">
          {{ saveError || pickup.error.value }}
        </p>
        <p v-else-if="saveSuccess" class="settings-success" role="status">{{ saveSuccess }}</p>
        <BaseButton
          type="submit"
          :loading="saving || pickup.pending.value"
          :disabled="saving || pickup.pending.value || !pickup.location.value"
        >
          Save pickup location
        </BaseButton>
      </form>
    </DashboardSection>

    <DashboardSection
      v-if="user?.role === 'user'"
      title="Payout bank account"
      description="Recycling rewards are sent here via Paystack TEST transfers when a pickup completes."
    >
      <p v-if="payoutLoading" class="muted">Loading payout settings…</p>
      <form v-else class="settings-form" @submit.prevent="savePayoutDetails">
        <p v-if="payoutAccountName" class="location-status">
          Verified as {{ payoutAccountName }}
          <template v-if="payoutHasRecipient"> · ready for transfers</template>
        </p>
        <label for="payout-bank">Bank</label>
        <select id="payout-bank" v-model="payoutBankCode" :disabled="payoutSaving || !payoutBanks.length" required>
          <option value="" disabled>Select bank</option>
          <option v-for="bank in payoutBanks" :key="bank.code" :value="bank.code">{{ bank.name }}</option>
        </select>
        <label for="payout-account">Account number (NUBAN)</label>
        <input
          id="payout-account"
          v-model="payoutAccountNumber"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          maxlength="10"
          pattern="\d{10}"
          placeholder="0123456789"
          :disabled="payoutSaving"
          required
        >
        <p v-if="!payoutBanks.length && !payoutError" class="muted">
          Add Paystack TEST keys to load Nigerian banks and enable transfers. Without keys, completed pickups still record a demo (mock) reward.
        </p>
        <p v-if="payoutError" class="form-error" role="alert">{{ payoutError }}</p>
        <p v-else-if="payoutSuccess" class="settings-success" role="status">{{ payoutSuccess }}</p>
        <BaseButton type="submit" :loading="payoutSaving" :disabled="payoutSaving || !payoutBanks.length">
          Save payout account
        </BaseButton>
      </form>
    </DashboardSection>

    <DashboardSection
      v-if="user?.role === 'recycler'"
      title="Business profile"
      description="Consumers see this name on matches, pickup requests, and history."
    >
      <p v-if="businessNameLoading" class="muted">Loading business profile…</p>
      <form v-else class="settings-form" @submit.prevent="saveBusinessName">
        <label for="business-name">Business name</label>
        <input
          id="business-name"
          v-model="businessName"
          type="text"
          minlength="2"
          maxlength="160"
          required
          placeholder="Yaba Circular"
          :disabled="businessNameSaving"
        >
        <p v-if="businessNameError" class="form-error" role="alert">{{ businessNameError }}</p>
        <p v-else-if="businessNameSuccess" class="settings-success" role="status">{{ businessNameSuccess }}</p>
        <BaseButton type="submit" :loading="businessNameSaving" :disabled="businessNameSaving">
          Save business name
        </BaseButton>
      </form>
    </DashboardSection>

    <DashboardSection
      v-else-if="user?.role === 'admin'"
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
  display: grid;
  gap: .85rem;
}
.settings-form label {
  font-size: .7rem;
  font-weight: 650;
  letter-spacing: .02em;
  color: #657269;
}
.settings-form select,
.settings-form input[type='text'] {
  min-height: 44px;
  border: 1px solid #cbd8c1;
  border-radius: 8px;
  background: #fffef9;
  padding: 9px 12px;
  color: #263c34;
  font: inherit;
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
