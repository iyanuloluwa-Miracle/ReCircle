/**
 * Manual product-path HTTP probe against a running Nuxt server.
 * Uses seeded password accounts (not /api/auth/demo).
 * Run: node --experimental-strip-types --env-file=.env scripts/probe-seeded-flow.ts
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { deflateSync } from 'node:zlib'
import { ByteshipClient } from '@byteship/js'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)

const base = process.env.AUTH_TEST_URL || process.env.NUXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
const password = process.env.DEMO_SEED_PASSWORD
if (!password || password.length < 12) {
  console.error('DEMO_SEED_PASSWORD must be set (≥12 chars)')
  process.exit(1)
}

let stage = 'boot'

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

function cookieFrom(response: Response) {
  const header = response.headers.getSetCookie?.() ?? []
  if (header.length) return header.map(entry => entry.split(';')[0]).join('; ')
  const single = response.headers.get('set-cookie')
  assert.ok(single, `${stage}: missing set-cookie`)
  return single.split(';')[0]!
}

async function api(path: string, options: {
  method?: string
  cookie?: string
  body?: unknown
  expect?: number | number[]
} = {}) {
  const headers: Record<string, string> = {}
  if (options.cookie) headers.cookie = options.cookie
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(new URL(path, base), {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: 'manual'
  })
  const expected = options.expect
  if (expected !== undefined) {
    const allowed = Array.isArray(expected) ? expected : [expected]
    const text = await response.clone().text()
    assert.ok(
      allowed.includes(response.status),
      `${stage}: ${options.method ?? 'GET'} ${path} → ${response.status} (wanted ${allowed.join('|')}): ${text.slice(0, 300)}`
    )
  }
  return response
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T
}

try {
  stage = 'health'
  const health = await api('/api/health', { expect: 200 })
  console.log('health', await json(health))

  stage = 'consumer login'
  const consumerLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'consumer@recircle-demo.example', password },
    expect: 200
  })
  const consumerCookie = cookieFrom(consumerLogin)
  const consumer = (await json<{ user: { id: string; role: string; location: { coordinates: [number, number] } | null; isDemo: boolean } }>(consumerLogin)).user
  assert.equal(consumer.role, 'user')
  assert.equal(consumer.isDemo, true)
  assert.ok(consumer.location?.coordinates)
  console.log('consumer login ok', consumer.id)

  stage = 'consumer me + dashboard'
  await api('/api/auth/me', { cookie: consumerCookie, expect: 200 })
  await api('/api/dashboard/user', { cookie: consumerCookie, expect: 200 })

  stage = 'upload token'
  const tokenRes = await api('/api/upload-token', { method: 'POST', cookie: consumerCookie, expect: 200 })
  const token = await json<{ token: string; folder: string; uploadId: string }>(tokenRes)
  const filePath = `${token.folder}/${token.uploadId}.png`

  stage = 'byteship upload'
  const byteship = new ByteshipClient({ uploadToken: token.token })
  const file = new File([samplePng()], 'probe-seeded.png', { type: 'image/png' })
  const uploaded = await byteship.upload(file, { path: filePath, visibility: 'public' })
  assert.equal(uploaded.status, 'ready')
  assert.ok(uploaded.url)
  console.log('upload ok')

  stage = 'draft'
  const draftRes = await api('/api/waste-items/draft', {
    method: 'POST',
    cookie: consumerCookie,
    body: { filePath, location: consumer.location, locationSource: 'demo' },
    expect: 200
  })
  const draft = await json<{ id: string; status: string }>(draftRes)
  assert.equal(draft.status, 'draft')
  console.log('draft', draft.id)

  stage = 'analyze'
  await api('/api/analyze-waste', {
    method: 'POST',
    cookie: consumerCookie,
    body: { wasteItemId: draft.id },
    expect: 200
  })
  const itemRes = await api(`/api/waste-items/${draft.id}`, { cookie: consumerCookie, expect: 200 })
  let item = await json<{
    status: string
    materialCode: string | null
    confidence: number | null
    classificationSource: string | null
  }>(itemRes)
  assert.equal(item.status, 'analyzed')
  console.log('analyzed', item.materialCode, 'confidence', item.confidence)

  stage = 'confirm material if needed'
  const needsConfirm = (item.confidence != null && item.confidence < 0.65)
    || ['UNKNOWN', 'MIXED', 'ORGANIC', 'EWASTE', 'STEEL', 'LDPE', 'PP'].includes(String(item.materialCode))
  if (needsConfirm) {
    const patch = await api(`/api/waste-items/${draft.id}/analysis`, {
      method: 'PATCH',
      cookie: consumerCookie,
      body: { materialCode: 'PET' },
      expect: 200
    })
    item = { ...item, ...(await json<{ materialCode: string; classificationSource: string }>(patch)) }
    console.log('confirmed material', item.materialCode)
  }

  stage = 'save weight'
  await api(`/api/waste-items/${draft.id}/analysis`, {
    method: 'PATCH',
    cookie: consumerCookie,
    body: { weightKg: 2.5 },
    expect: 200
  })

  stage = 'match recyclers'
  const matchRes = await api('/api/match-recycler', {
    method: 'POST',
    cookie: consumerCookie,
    body: { wasteItemId: draft.id, weightKg: 2.5 },
    expect: 200
  })
  const match = await json<{
    status: string
    matches: Array<{ recyclerId: string; businessName: string; matchScore: number }>
    recommended: { recyclerId: string; businessName: string } | null
  }>(matchRes)
  console.log('matches', match.matches.length, 'recommended', match.recommended?.businessName ?? null)
  assert.ok(match.matches.length > 0, 'expected at least one recycler match')
  assert.ok(match.recommended)

  stage = 'create request'
  const pickupAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const requestRes = await api('/api/create-request', {
    method: 'POST',
    cookie: consumerCookie,
    body: {
      wasteItemId: draft.id,
      recyclerId: match.recommended.recyclerId,
      requestedPickupTime: pickupAt
    },
    expect: 200
  })
  const request = await json<{ id: string; status: string; expectedPayout: number }>(requestRes)
  assert.equal(request.status, 'pending')
  console.log('request', request.id, 'payout', request.expectedPayout)

  stage = 'recycler login'
  const recyclerLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'recycler1@recircle-demo.example', password },
    expect: 200
  })
  const recyclerCookie = cookieFrom(recyclerLogin)
  const recyclerUser = (await json<{ user: { id: string; role: string } }>(recyclerLogin)).user
  assert.equal(recyclerUser.role, 'recycler')
  console.log('recycler login ok', recyclerUser.id)

  stage = 'recycler dashboard'
  const dash = await api('/api/dashboard/recycler', { cookie: recyclerCookie, expect: 200 })
  const dashBody = await json<{ incoming: Array<{ id: string }> }>(dash)
  const incomingIds = dashBody.incoming.map(entry => entry.id)
  console.log('incoming count', incomingIds.length)
  assert.ok(incomingIds.includes(request.id), 'new request should appear on recycler incoming list')

  stage = 'wallet top-up'
  const topUp = await api('/api/wallet/top-up/demo', {
    method: 'POST',
    cookie: recyclerCookie,
    body: { amount: 20_000 },
    expect: [200, 409]
  })
  if (topUp.status === 200) {
    const topUpBody = await json<{ available: number; amount: number }>(topUp)
    console.log('demo top-up', topUpBody.amount, 'available', topUpBody.available)
  } else {
    console.log('demo top-up skipped (Paystack configured)')
  }

  stage = 'accept'
  const accept = await api(`/api/requests/${request.id}/status`, {
    method: 'PATCH',
    cookie: recyclerCookie,
    body: { status: 'accepted', confirmedPickupTime: pickupAt },
    expect: 200
  })
  const acceptBody = await json<{ status: string; lockedPayout: number | null }>(accept)
  assert.equal(acceptBody.status, 'accepted')
  console.log('accepted; lockedPayout', acceptBody.lockedPayout)

  stage = 'picked_up'
  const picked = await api(`/api/requests/${request.id}/status`, {
    method: 'PATCH',
    cookie: recyclerCookie,
    body: { status: 'picked_up' },
    expect: 200
  })
  assert.equal((await json<{ status: string }>(picked)).status, 'picked_up')

  stage = 'completed'
  const completed = await api(`/api/requests/${request.id}/status`, {
    method: 'PATCH',
    cookie: recyclerCookie,
    body: { status: 'completed' },
    expect: 200
  })
  const completedBody = await json<{ status: string; settledAt: string | null; lockedPayout: number | null }>(completed)
  assert.equal(completedBody.status, 'completed')
  assert.ok(completedBody.settledAt)
  console.log('completed; settled', completedBody.lockedPayout)

  stage = 'consumer wallet'
  const userDash = await api('/api/dashboard/user', { cookie: consumerCookie, expect: 200 })
  const wallet = await json<{
    metrics: { totalEarnedNgn: number; walletAvailableNgn: number }
  }>(userDash)
  assert.ok(
    wallet.metrics.walletAvailableNgn >= (completedBody.lockedPayout ?? request.expectedPayout),
    'consumer wallet should include the settled pickup reward'
  )
  assert.ok(wallet.metrics.totalEarnedNgn >= (completedBody.lockedPayout ?? request.expectedPayout))
  console.log('wallet available', wallet.metrics.walletAvailableNgn, 'earned', wallet.metrics.totalEarnedNgn)

  stage = 'admin login'
  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@recircle-demo.example', password },
    expect: 200
  })
  const adminCookie = cookieFrom(adminLogin)
  await api('/api/dashboard/admin', { cookie: adminCookie, expect: 200 })
  console.log('admin dashboard ok')

  console.log('\nSEEDED FLOW OK')
} catch (error) {
  console.error(`\nFAILED at ${stage}`)
  console.error(error)
  process.exitCode = 1
}
