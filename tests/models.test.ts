import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { User } from '../server/models/User.ts'
import { Recycler } from '../server/models/Recycler.ts'
import { WasteItem } from '../server/models/WasteItem.ts'
import { Request } from '../server/models/Request.ts'
import { Transaction } from '../server/models/Transaction.ts'

const owner = new Types.ObjectId()
const location = { type: 'Point', coordinates: [3.39, 6.45] }

test('GeoJSON accepts Lagos coordinates and rejects out-of-range coordinates', async () => {
  const user = new User({ name: 'Demo User', email: 'demo@example.invalid', passwordHash: 'hash', role: 'user', location })
  assert.equal(await user.validate(), undefined)
  user.location = { type: 'Point', coordinates: [6.45, 190] }
  await assert.rejects(user.validate())
})

test('recycler validates pricing and material consistency', async () => {
  const recycler = new Recycler({
    userId: owner, businessName: 'Demo Recycler', location,
    acceptedMaterials: ['pet'], pricingRules: [{ material: 'pet', pricePerKg: 80, currency: 'NGN' }],
    capacityKgPerDay: 100, currentLoadKg: 10, availability: 'available', serviceRadiusKm: 5
  })
  assert.equal(await recycler.validate(), undefined)
  recycler.pricingRules = [{ material: 'glass', pricePerKg: 20, currency: 'NGN' }]
  await assert.rejects(recycler.validate())
  recycler.pricingRules = [{ material: 'pet', pricePerKg: 80, currency: 'NGN' }]
  recycler.currentLoadKg = 101
  await assert.rejects(recycler.validate())
})

test('waste value range and confidence are bounded', async () => {
  const waste = new WasteItem({
    userId: owner, imageUrl: 'https://example.invalid/demo.jpg', materialCode: 'pet',
    itemName: 'Bottle', recyclability: 'recyclable', confidence: 0.9,
    disposalMethod: 'Recycle', location, estimatedValueMin: 100, estimatedValueMax: 200
  })
  assert.equal(await waste.validate(), undefined)
  waste.estimatedValueMax = 50
  await assert.rejects(waste.validate())
})

test('a waste draft needs only its owner, image, and location', async () => {
  const draft = new WasteItem({ userId: owner, imageUrl: 'https://example.invalid/draft.png', location, status: 'draft' })
  assert.equal(await draft.validate(), undefined)
  draft.status = 'analyzed'
  await assert.rejects(draft.validate())
})

test('operational collections declare required geospatial and lookup indexes', () => {
  const hasIndex = (indexes: ReturnType<typeof Recycler.schema.indexes>, key: Record<string, number | string>) =>
    indexes.some(([candidate]) => Object.entries(key).every(([field, value]) => candidate[field] === value))
  assert.ok(hasIndex(Recycler.schema.indexes(), { location: '2dsphere' }))
  assert.ok(hasIndex(Recycler.schema.indexes(), { acceptedMaterials: 1, availability: 1 }))
  assert.ok(hasIndex(WasteItem.schema.indexes(), { location: '2dsphere' }))
  assert.ok(hasIndex(Request.schema.indexes(), { recyclerId: 1, status: 1 }))
  assert.ok(hasIndex(Transaction.schema.indexes(), { status: 1, createdAt: -1 }))
})
