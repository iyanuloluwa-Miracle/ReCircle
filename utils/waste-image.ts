export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImageMimeType = typeof IMAGE_MIME_TYPES[number]

export function imageExtension(type: ImageMimeType) {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'
}

export function hasImageSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  if (contentType === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

export async function validateImageFile(file: Blob): Promise<string | null> {
  if (!IMAGE_MIME_TYPES.includes(file.type as ImageMimeType)) return 'Choose a JPEG, PNG, or WEBP image.'
  if (file.size < 1) return 'This image is empty. Choose another file.'
  if (file.size > MAX_IMAGE_BYTES) return 'Choose an image smaller than 5 MB.'
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!hasImageSignature(header, file.type)) return 'This file is not a valid JPEG, PNG, or WEBP image.'
  return null
}
