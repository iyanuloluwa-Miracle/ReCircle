<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const pending = ref(false)
const errorMessage = ref('')

async function finish() {
  pending.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ user: typeof auth.user.value }>('/api/onboarding/complete', { method: 'POST' })
    auth.user.value = result.user
    await navigateTo('/dashboard/operator')
  } catch {
    errorMessage.value = 'Could not finish setup. Try again.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({ title: 'Operator setup — ReCircle', robots: 'noindex' })
</script>

<template>
  <AuthSplit title="Coordinate the network.">
    <div class="onboard-stack">
      <p class="muted auth-hint">
        As a waste operator you monitor pickups, recycler utilization, and zone batching.
        Recyclers accept and complete jobs — you do not change request status.
      </p>
      <ul class="howto-list">
        <li>Watch the live collection queue.</li>
        <li>Review recycler capacity across Lagos.</li>
        <li>Run zone optimize when batches need grouping.</li>
      </ul>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <BaseButton :loading="pending" :disabled="pending" @click="finish">Open operator dashboard</BaseButton>
    </div>
  </AuthSplit>
</template>
