import type { GeoPoint } from '../../types'
import { imageExtension, validateImageFile, type ImageMimeType } from '../../utils/waste-image'
import type { PickupLocationSource } from './usePickupLocation'

type UploadStage = 'idle' | 'token' | 'uploading' | 'saving' | 'done'

export function useWasteUpload() {
  const file = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const stage = ref<UploadStage>('idle')
  const progress = ref(0)
  const error = ref('')
  const uploadedPath = ref<string | null>(null)
  const busy = computed(() => stage.value === 'token' || stage.value === 'uploading' || stage.value === 'saving')
  let controller: AbortController | null = null
  let generation = 0

  function clearFile() {
    generation += 1
    controller?.abort()
    controller = null
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
    file.value = null
    uploadedPath.value = null
    progress.value = 0
    stage.value = 'idle'
    error.value = ''
  }

  async function selectFile(candidate: File) {
    if (busy.value) return
    const invalid = await validateImageFile(candidate)
    if (invalid) {
      error.value = invalid
      return
    }
    clearFile()
    file.value = candidate
    previewUrl.value = URL.createObjectURL(candidate)
  }

  async function submit(location: GeoPoint, locationSource: PickupLocationSource): Promise<string | null> {
    if (!file.value || busy.value) return null
    const run = ++generation
    error.value = ''
    controller = new AbortController()
    try {
      if (!uploadedPath.value) {
        stage.value = 'token'
        const token = await $fetch<{ token: string; folder: string; uploadId: string }>('/api/upload-token', {
          method: 'POST', signal: controller.signal
        })
        if (!token.token || !token.folder || !token.uploadId) throw new Error('Upload token unavailable')
        const path = `${token.folder}/${token.uploadId}.${imageExtension(file.value.type as ImageMimeType)}`
        const { ByteshipClient } = await import('@byteship/js')
        const byteship = new ByteshipClient({ uploadToken: token.token })
        stage.value = 'uploading'
        const uploaded = await byteship.upload(file.value, {
          path, visibility: 'public', signal: controller.signal,
          onProgress: report => { if (run === generation) progress.value = Math.max(0, Math.min(100, Math.round(report.percent))) }
        })
        if (uploaded.status !== 'ready' || !uploaded.url || uploaded.path !== path) throw new Error('Upload did not complete')
        uploadedPath.value = path
      }
      stage.value = 'saving'
      const draft = await $fetch<{ id: string }>('/api/waste-items/draft', {
        method: 'POST', body: { filePath: uploadedPath.value, location, locationSource }, signal: controller.signal
      })
      if (run !== generation) return null
      stage.value = 'done'
      return draft.id
    } catch {
      if (run !== generation) return null
      error.value = stage.value === 'token'
        ? 'Could not prepare an upload. Check your connection and try again.'
        : stage.value === 'uploading'
          ? 'The image upload failed. Try again with the same photo.'
          : 'The image uploaded, but the draft could not be saved. Try again.'
      stage.value = 'idle'
      return null
    } finally {
      if (run === generation) controller = null
    }
  }

  onUnmounted(clearFile)
  return { file, previewUrl, stage, progress, error, uploadedPath, busy, selectFile, clearFile, submit }
}
