<script setup lang="ts">
import { onboardingStepsForRole } from '../../../utils/onboarding'

definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const pending = ref(false)
const errorMessage = ref('')
const steps = computed(() => onboardingStepsForRole('admin'))

const guideSteps = [
  {
    icon: 'refresh' as const,
    title: 'Monitor',
    detail: 'Watch the live collection queue across zones.'
  },
  {
    icon: 'building' as const,
    title: 'Capacity',
    detail: 'Review recycler utilization across Nigeria.'
  },
  {
    icon: 'pin' as const,
    title: 'Batch',
    detail: 'Run zone optimize when pickups need grouping.'
  },
  {
    icon: 'shield' as const,
    title: 'Oversee',
    detail: 'Recyclers accept and complete jobs — you coordinate, not change status.'
  }
]

async function finish() {
  pending.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ user: typeof auth.user.value }>('/api/onboarding/complete', { method: 'POST' })
    auth.user.value = result.user
    await navigateTo('/dashboard/admin')
  } catch {
    errorMessage.value = 'Could not finish setup. Try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Admin setup — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit title="Admin access." variant="card" :steps="steps" :current-step="2">
    <div class="onboard-stack onboard-stack--guide">
      <p class="muted auth-hint auth-hint--center">Four moves from queue to collection plan.</p>
      <ol class="onboard-guide" aria-label="How admins work">
        <li
          v-for="(guide, index) in guideSteps"
          :key="guide.title"
          class="onboard-guide-step"
          :class="{ 'is-last': index === guideSteps.length - 1 }"
          :style="{ '--guide-index': index }"
        >
          <span class="onboard-guide-rail" aria-hidden="true" />
          <span class="onboard-guide-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="onboard-guide-icon">
            <ScanIcon :name="guide.icon" :size="18" />
          </span>
          <div class="onboard-guide-copy">
            <strong>{{ guide.title }}</strong>
            <p>{{ guide.detail }}</p>
          </div>
        </li>
      </ol>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton :loading="pending" :disabled="pending" @click="finish">Go to dashboard</BaseButton>
    </div>
  </AuthSplit>
</template>
