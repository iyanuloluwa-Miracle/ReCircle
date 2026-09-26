<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <section class="toast-region" aria-label="Notifications" aria-live="polite" aria-relevant="additions removals">
      <TransitionGroup name="toast">
        <article v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast--${toast.tone}`" :role="toast.tone === 'error' ? 'alert' : 'status'">
          <span class="toast-mark" aria-hidden="true">
            <AppIcon :name="toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'alert' : 'info'" :size="16" />
          </span>
          <div class="toast-copy"><strong>{{ toast.title }}</strong><p v-if="toast.message">{{ toast.message }}</p></div>
          <button type="button" class="toast-dismiss" :aria-label="`Dismiss: ${toast.title}`" @click="dismiss(toast.id)">
            <AppIcon name="close" :size="14" />
          </button>
        </article>
      </TransitionGroup>
    </section>
  </Teleport>
</template>
