import assert from 'node:assert/strict'
import test from 'node:test'
import { hasImageSignature, MAX_IMAGE_BYTES, validateImageFile } from '../utils/waste-image.ts'

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])

test('scanner accepts an image with matching MIME type and signature', async () => {
  assert.equal(await validateImageFile(new Blob([png], { type: 'image/png' })), null)
  assert.equal(hasImageSignature(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'), true)
  assert.equal(hasImageSignature(new TextEncoder().encode('RIFF1234WEBP'), 'image/webp'), true)
})

test('scanner rejects spoofed, unsupported, empty, and oversized files', async () => {
  assert.match((await validateImageFile(new Blob(['not an image'], { type: 'image/png' })))!, /not a valid/)
  assert.match((await validateImageFile(new Blob(['hello'], { type: 'text/plain' })))!, /JPEG/)
  assert.match((await validateImageFile(new Blob([], { type: 'image/png' })))!, /empty/)
  assert.match((await validateImageFile(new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: 'image/png' })))!, /smaller than 5 MB/)
})
