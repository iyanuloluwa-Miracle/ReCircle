/**
 * Reconcile consumer + recycler dashboard API metrics against MongoDB.
 * node --experimental-strip-types --env-file=.env scripts/verify-dashboards.ts
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import mongoose, { Types } from 'mongoose'
import { User } from '../server/models/User.ts'
import { Recycler } from '../server/models/Recycler.ts'
import { WasteItem } from '../server/models/WasteItem.ts'
import { Request } from '../server/models/Request.ts'
import { Transaction } from '../server/models/Transaction.ts'
import { computeRecyclingStreak } from '../utils/dashboard-metrics.ts'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)

const base = process.env.AUTH_TEST_URL || process.env.NUXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
const password = process.env.DEMO_SEED_PASSWORD
const uri = process.env.MONGODB_URI
if (!password || password.length < 12) throw new Error('DEMO_SEED_PASSWORD required')
if (!uri) throw new Error('MONGODB_URI required')

function cookieFrom(response: Response) {
  const header = response.headers.get('set-cookie')
  assert.ok(header, 'missing session cookie')
  return header.split(';')[0]!
}

async function login(email: string) {
  const response = await fetch(new URL('/api/auth/login', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  assert.equal(response.status, 200, `login failed for ${email}: ${response.status}`)
  return cookieFrom(response)
}

async function dashboard<T>(path: string, cookie: string): Promise<T> {
  const response = await fetch(new URL(path, base), { headers: { cookie } })
  const text = await response.text()
  assert.equal(response.status, 200, `${path} → ${response.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text) as T
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'OK' : 'MISMATCH'}  ${label}`)
  console.log(`         api=${JSON.stringify(actual)}  db=${JSON.stringify(expected)}`)
  if (!ok) throw new Error(`Mismatch: ${label}`)
}

try {
  stage: {
    const health = await fetch(new URL('/api/health', base))
    assert.equal(health.status, 200, `health ${health.status}`)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })

  const consumerCookie = await login('consumer@recircle-demo.example')
  const recyclerCookie = await login('recycler1@recircle-demo.example')

  const consumerApi = await dashboard<{
    metrics: {
      wasteDivertedKg: number
      totalEarnedNgn: number
      activePickups: number
      recyclingStreakDays: number
    }
    activePickups: unknown[]
    recentScans: unknown[]
    walletActivity: Array<{ amount: number; status: string; provider: string; requestId?: string }>
  }>('/api/dashboard/user', consumerCookie)

  const recyclerApi = await dashboard<{
    recycler: { businessName: string; capacityKgPerDay: number } | null
    metrics: {
      availableSupplyKg: number
      jobsToday: number
      potentialPurchaseValueNgn: number
      completedCollections: number
    }
    incoming: Array<{ weightKg: number | null; expectedPayout: number; status: string }>
    acceptedPickups: unknown[]
    capacity: {
      capacityKgPerDay: number
      currentLoadKg: number
      remainingCapacityKg: number
      utilizationPct: number
    } | null
    materialBreakdown: Array<{ materialCode: string; weightKg: number; count: number; valueNgn: number }>
  }>('/api/dashboard/recycler', recyclerCookie)

  const consumer = await User.findOne({ email: 'consumer@recircle-demo.example' }).lean()
  assert.ok(consumer)
  const consumerId = consumer._id as Types.ObjectId

  const [wasteDiverted, earned, completedDates, activeRequestCount, walletCount] = await Promise.all([
    WasteItem.aggregate<{ totalKg: number }>([
      { $match: { userId: consumerId, status: { $in: ['picked_up', 'completed'] }, weightKg: { $gt: 0 } } },
      { $group: { _id: null, totalKg: { $sum: '$weightKg' } } }
    ]),
    Transaction.aggregate<{ total: number }>([
      { $match: { userId: consumerId, status: 'completed', type: 'recycling_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Request.find({ userId: consumerId, status: 'completed', completedAt: { $ne: null } }).select('completedAt').lean(),
    Request.countDocuments({ userId: consumerId, status: { $in: ['pending', 'accepted', 'picked_up'] } }),
    Transaction.countDocuments({ userId: consumerId })
  ])

  const expectedWaste = Math.round((wasteDiverted[0]?.totalKg ?? 0) * 100) / 100
  const expectedEarned = Math.round(earned[0]?.total ?? 0)
  const expectedStreak = computeRecyclingStreak(
    completedDates.map(entry => entry.completedAt!).filter(Boolean)
  )

  console.log('\n=== CONSUMER ===')
  check('wasteDivertedKg', consumerApi.metrics.wasteDivertedKg, expectedWaste)
  check('totalEarnedNgn', consumerApi.metrics.totalEarnedNgn, expectedEarned)
  check('activePickups', consumerApi.metrics.activePickups, activeRequestCount)
  check('recyclingStreakDays', consumerApi.metrics.recyclingStreakDays, expectedStreak)
  check('activePickups list length', consumerApi.activePickups.length, activeRequestCount)
  assert.ok(consumerApi.walletActivity.length <= 8)
  assert.ok(walletCount >= consumerApi.walletActivity.length)
  const walletSumCompleted = consumerApi.walletActivity
    .filter(entry => entry.status === 'completed')
    .reduce((sum, entry) => sum + entry.amount, 0)
  // Wallet is last 8 only; total earned is all-time completed — wallet subset ≤ total
  assert.ok(walletSumCompleted <= expectedEarned + 0.01)
  console.log(`wallet entries=${consumerApi.walletActivity.length} recentScans=${consumerApi.recentScans.length}`)
  console.log(`wallet providers: ${[...new Set(consumerApi.walletActivity.map(e => e.provider))].join(', ') || '(none)'}`)

  const recyclerUser = await User.findOne({ email: 'recycler1@recircle-demo.example' }).lean()
  assert.ok(recyclerUser)
  const profile = await Recycler.findOne({ userId: recyclerUser._id }).lean()
  assert.ok(profile, 'recycler1 profile missing')
  const recyclerId = profile._id as Types.ObjectId
  const today = startOfUtcDay()

  const [pendingJobs, jobsToday, completedCollections, acceptedOrPicked] = await Promise.all([
    Request.find({ recyclerId, status: 'pending' }).lean(),
    Request.countDocuments({
      recyclerId,
      createdAt: { $gte: today },
      status: { $nin: ['cancelled', 'rejected'] }
    }),
    Request.countDocuments({ recyclerId, status: 'completed' }),
    Request.countDocuments({ recyclerId, status: { $in: ['accepted', 'picked_up'] } })
  ])

  const pendingWasteIds = pendingJobs.map(job => job.wasteItemId)
  const pendingWaste = await WasteItem.find({ _id: { $in: pendingWasteIds } }).select('weightKg').lean()
  const weightById = new Map(pendingWaste.map(item => [item._id.toString(), item.weightKg ?? 0]))
  const expectedSupply = Math.round(
    pendingJobs.reduce((sum, job) => sum + (weightById.get(job.wasteItemId.toString()) ?? 0), 0) * 100
  ) / 100
  const expectedPurchase = Math.round(pendingJobs.reduce((sum, job) => sum + job.expectedPayout, 0))
  const remaining = Math.max(0, profile.capacityKgPerDay - profile.currentLoadKg)
  const utilization = profile.capacityKgPerDay > 0
    ? Math.round((profile.currentLoadKg / profile.capacityKgPerDay) * 1000) / 10
    : 0

  console.log('\n=== RECYCLER1 (Yaba) ===')
  assert.ok(recyclerApi.recycler)
  check('businessName', recyclerApi.recycler.businessName, profile.businessName)
  check('availableSupplyKg', recyclerApi.metrics.availableSupplyKg, expectedSupply)
  check('jobsToday', recyclerApi.metrics.jobsToday, jobsToday)
  check('potentialPurchaseValueNgn', recyclerApi.metrics.potentialPurchaseValueNgn, expectedPurchase)
  check('completedCollections', recyclerApi.metrics.completedCollections, completedCollections)
  check('incoming length', recyclerApi.incoming.length, pendingJobs.length)
  check('acceptedPickups length', recyclerApi.acceptedPickups.length, acceptedOrPicked)
  assert.ok(recyclerApi.capacity)
  check('capacityKgPerDay', recyclerApi.capacity.capacityKgPerDay, profile.capacityKgPerDay)
  check('currentLoadKg', recyclerApi.capacity.currentLoadKg, profile.currentLoadKg)
  check('remainingCapacityKg', recyclerApi.capacity.remainingCapacityKg, remaining)
  check('utilizationPct', recyclerApi.capacity.utilizationPct, utilization)
  console.log(`materialBreakdown rows=${recyclerApi.materialBreakdown.length}`)

  // Cross-check: consumer total earned should equal sum of completed txs in DB
  const allTx = await Transaction.find({ userId: consumerId, status: 'completed' }).select('amount').lean()
  const txSum = Math.round(allTx.reduce((sum, entry) => sum + entry.amount, 0))
  check('totalEarned vs all completed txs', consumerApi.metrics.totalEarnedNgn, txSum)

  console.log('\nDASHBOARD RECONCILIATION OK')
} catch (error) {
  console.error('\nDASHBOARD RECONCILIATION FAILED')
  console.error(error)
  process.exitCode = 1
} finally {
  await mongoose.disconnect().catch(() => undefined)
}
