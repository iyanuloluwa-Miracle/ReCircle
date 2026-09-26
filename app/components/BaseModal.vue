<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const dialog = ref<HTMLDialogElement>()
const headingId = useId()
watch(() => props.open, async (open) => {
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  else if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })
function close() { emit('update:open', false) }
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-labelledby="headingId" @cancel.prevent="close" @close="close" @click="($event.target === dialog) && close()">
    <div class="modal-content">
      <header class="modal-heading">
        <h2 :id="headingId">{{ title }}</h2>
        <button class="icon-button" type="button" aria-label="Close dialog" @click="close">
          <AppIcon name="close" :size="18" />
        </button>
      </header>
      <slot />
      <footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>
