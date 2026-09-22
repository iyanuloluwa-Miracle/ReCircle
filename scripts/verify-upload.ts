import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { deflateSync } from 'node:zlib'
import { ByteshipClient } from '@byteship/js'
import mongoose from 'mongoose'
import { WasteItem } from '../server/models/WasteItem.ts'
import type { AuthResponse } from '../types/index.ts'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)
const base = process.env.AUTH_TEST_URL || 'http://127.0.0.1:3001'
let stage = 'demo login'
let filePath: string | null = null
let draftId: string | null = null
let ownerId: string | null = null

function pngChunk(name: string, data: Buffer) {
  const nameBytes = Buffer.from(name)
  const checksumData = Buffer.concat([nameBytes, data])
  let crc = 0xffffffff
  for (const byte of checksumData) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  nameBytes.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length)
  return result
}

function samplePng() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 32, 122, 80]))),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

async function post(path: string, cookie: string, body?: object) {
  return fetch(new URL(path, base), {
    method: 'POST', headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
}

try {
  const login = await fetch(new URL('/api/auth/demo', base), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'user' })
  })
  assert.equal(login.status, 200)
  const account = (await login.json() as AuthResponse).user
  assert.ok(account.isDemo && account.location)
  ownerId = account.id
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie)
  const scanner = await fetch(new URL('/scan', base), { headers: { cookie } })
  assert.equal(scanner.status, 200)
  const scannerHtml = await scanner.text()
  assert.match(scannerHtml, /Choose photo/)
  assert.match(scannerHtml, /Use camera/)
  assert.match(scannerHtml, /Demo pickup location/)
  const guestToken = await fetch(new URL('/api/upload-token', base), { method: 'POST' })
  assert.equal(guestToken.status, 401)
  const recyclerLogin = await fetch(new URL('/api/auth/demo', base), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'recycler' })
  })
  assert.equal(recyclerLogin.status, 200)
  const recyclerCookie = recyclerLogin.headers.get('set-cookie')?.split(';')[0]
  assert.ok(recyclerCookie)
  assert.equal((await post('/api/upload-token', recyclerCookie)).status, 403)
  const recyclerScanner = await fetch(new URL('/scan', base), { headers: { cookie: recyclerCookie }, redirect: 'manual' })
  assert.equal(recyclerScanner.status, 302)
  assert.equal(new URL(recyclerScanner.headers.get('location')!, base).pathname, '/dashboard/recycler')
  const invalidDraft = await post('/api/waste-items/draft', cookie, {
    filePath: 'waste-images/someone-else/test.png', location: account.location, locationSource: 'demo'
  })
  assert.equal(invalidDraft.status, 400)

  stage = 'token creation'
  const response = await post('/api/upload-token', cookie)
  assert.equal(response.status, 200)
  const token = await response.json() as { token: string; folder: string; uploadId: string; expiresAt: string; maxBytes: number }
  assert.ok(token.token.startsWith('bsut_'))
  assert.equal(token.folder, `waste-images/${account.id}`)
  assert.equal(token.maxBytes, 5 * 1024 * 1024)
  assert.ok(Number.isFinite(Date.parse(token.expiresAt)))
  assert.equal('byteshipApiKey' in token, false)
  if (process.env.BYTESHIP_API_KEY) assert.equal(JSON.stringify(token).includes(process.env.BYTESHIP_API_KEY), false)
  filePath = `${token.folder}/${token.uploadId}.png`

  stage = 'Byteship upload'
  const byteship = new ByteshipClient({ uploadToken: token.token })
  const file = new File([samplePng()], 'demo-scanner-test.png', { type: 'image/png' })
  const uploaded = await byteship.upload(file, { path: filePath, visibility: 'public' })
  assert.equal(uploaded.status, 'ready')
  assert.equal(uploaded.visibility, 'public')
  assert.ok(uploaded.url)
  console.log('Byteship token and public image upload verified')

  stage = 'draft creation'
  let draftResponse: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    draftResponse = await post('/api/waste-items/draft', cookie, {
      filePath, location: account.location, locationSource: 'demo'
    })
    if (draftResponse.status !== 502) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(draftResponse?.status, 200)
  const draft = await draftResponse.json() as { id: string; imageUrl: string; status: string }
  assert.equal(draft.status, 'draft')
  assert.equal(draft.imageUrl, uploaded.url)
  draftId = draft.id
  const again = await post('/api/waste-items/draft', cookie, { filePath, location: account.location, locationSource: 'demo' })
  assert.equal(again.status, 200)
  assert.equal((await again.json() as { id: string }).id, draft.id)
  const saved = await fetch(new URL(`/api/waste-items/${draft.id}`, base), { headers: { cookie } })
  assert.equal(saved.status, 200)
  const savedBody = await saved.json() as { status: string; locationSource: string }
  assert.equal(savedBody.status, 'draft')
  assert.equal(savedBody.locationSource, 'demo')
  const analysis = await fetch(new URL(`/scan/${draft.id}/analysis`, base), { headers: { cookie } })
  assert.equal(analysis.status, 200)
  assert.match(await analysis.text(), /Ready for a closer look/)
  console.log('Draft persistence, retry idempotence, and analysis handoff verified')
} catch (error) {
  console.error(`Upload HTTP check failed during ${stage} (${error instanceof Error ? error.name : 'UnknownError'}).`)
  if (error instanceof assert.AssertionError) console.error(error.message)
  process.exitCode = 1
} finally {
  if (filePath && process.env.BYTESHIP_API_KEY) {
    try {
      const project = new ByteshipClient({ apiKey: process.env.BYTESHIP_API_KEY })
      await project.deleteFile(filePath)
      if (draftId && ownerId && process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
        await WasteItem.deleteOne({ _id: draftId, userId: ownerId, storagePath: filePath, isDemo: true })
      }
      console.log('Temporary demo upload and draft removed')
    } catch {
      console.log('Temporary demo upload remains; storage key may lack delete permission')
    } finally {
      if (mongoose.connection.readyState === 1) await mongoose.disconnect()
    }
  }
}
