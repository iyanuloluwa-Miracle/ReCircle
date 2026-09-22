import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import mongoose, { Types, type Model } from 'mongoose'
import { User } from '../server/models/User.ts'
import { Recycler } from '../server/models/Recycler.ts'
import { WasteItem } from '../server/models/WasteItem.ts'
import { Request } from '../server/models/Request.ts'
import { Transaction } from '../server/models/Transaction.ts'
import { hashPassword } from '../server/services/password.ts'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is required to seed and verify MongoDB indexes.')
  process.exitCode = 1
} else {
  try {
    await runSeed(uri)
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('MONGODB_URI must') || error.message.startsWith('Set DEMO_SEED_PASSWORD'))) {
      console.error(error.message)
    } else {
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      console.error(`Demo seed failed (${errorName}); check database access, model validation, and indexes.`)
      if (error instanceof mongoose.Error.ValidationError) {
        console.error(`Invalid fields: ${Object.keys(error.errors).join(', ')}`)
      }
    }
    process.exitCode = 1
  }
}

function id(suffix: number) {
  return new Types.ObjectId(`de000000000000000000${suffix.toString(16).padStart(4, '0')}`)
}

function point(longitude: number, latitude: number) {
  return { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] }
}

async function insertDemo(model: Model<unknown>, document: Record<string, unknown>) {
  const insertedDocument = { ...document }
  insertedDocument.createdAt ??= new Date()
  if (model.schema.path('updatedAt')) insertedDocument.updatedAt ??= insertedDocument.createdAt
  // Document validation provides the full sibling fields to cross-field validators.
  await new model(insertedDocument).validate()
  await model.updateOne(
    { _id: document._id, isDemo: true },
    { $setOnInsert: insertedDocument },
    { upsert: true, timestamps: false }
  )
}

async function verifyIndexes(model: Model<unknown>) {
  await model.createIndexes()
  const actual = await model.collection.listIndexes().toArray()
  for (const [key, options] of model.schema.indexes()) {
    const found = actual.some(index =>
      Object.entries(key).every(([field, direction]) => index.key[field] === direction)
      && (!options.unique || index.unique === true)
    )
    if (!found) throw new Error(`Index verification failed for ${model.modelName}: ${JSON.stringify(key)}`)
  }
  console.log(`${model.modelName}: ${actual.length} indexes verified`)
}

async function runSeed(mongodbUri: string) {
  // MongoDB URIs can list several hosts; WHATWG URL rejects that valid format.
  const databaseName = decodeURIComponent(mongodbUri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1] ?? '')
  if (!databaseName || ['admin', 'local', 'config'].includes(databaseName)) {
    throw new Error('MONGODB_URI must specify a non-system database name in its path.')
  }
  const demoPassword = process.env.DEMO_SEED_PASSWORD
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_SEED_PASSWORD to a local value of at least 12 characters; it is never committed.')
  }
  await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 })
  try {
    const passwordHash = await hashPassword(demoPassword)
    const consumerId = id(1)
    const operatorId = id(2)
    const consumerPoint = point(3.3947, 6.4541)
    await insertDemo(User, { _id: consumerId, name: 'Demo Consumer', email: 'consumer@recykle-demo.example', passwordHash, role: 'user', location: consumerPoint, isDemo: true })
    await insertDemo(User, { _id: operatorId, name: 'Demo Waste Operator', email: 'operator@recykle-demo.example', passwordHash, role: 'waste_operator', location: consumerPoint, isDemo: true })

    // Fictional businesses and invented prices for product demonstration only.
    const businesses = [
      { name: 'Yaba Circular Demo', coords: point(3.3889, 6.5095), materials: ['pet', 'aluminium', 'cardboard'], prices: [80, 260, 35], capacity: 400, load: 60, radius: 15 },
      { name: 'Surulere Renew Demo', coords: point(3.3572, 6.4979), materials: ['pet', 'hdpe', 'paper'], prices: [75, 95, 25], capacity: 500, load: 120, radius: 18 },
      { name: 'Ikeja Recovery Demo', coords: point(3.3426, 6.6018), materials: ['aluminium', 'glass', 'cardboard'], prices: [245, 20, 30], capacity: 350, load: 80, radius: 20 },
      { name: 'Lekki Reuse Demo', coords: point(3.4767, 6.4474), materials: ['pet', 'glass', 'paper'], prices: [85, 18, 28], capacity: 300, load: 30, radius: 14 }
    ]
    for (const [index, business] of businesses.entries()) {
      const userId = id(10 + index)
      await insertDemo(User, { _id: userId, name: `${business.name} Team`, email: `recycler${index + 1}@recykle-demo.example`, passwordHash, role: 'recycler', location: business.coords, isDemo: true })
      await insertDemo(Recycler, {
        _id: id(20 + index), userId, businessName: business.name, location: business.coords,
        acceptedMaterials: business.materials,
        pricingRules: business.materials.map((material, i) => ({ material, pricePerKg: business.prices[i], currency: 'NGN' })),
        capacityKgPerDay: business.capacity, currentLoadKg: business.load,
        availability: 'available', serviceRadiusKm: business.radius, isDemo: true
      })
    }

    const historical = [
      { material: 'pet', item: 'PET bottles', weight: 4, recycler: 20, price: 80, daysAgo: 25 },
      { material: 'aluminium', item: 'Aluminium cans', weight: 2, recycler: 20, price: 260, daysAgo: 18 },
      { material: 'paper', item: 'Paper bundle', weight: 7, recycler: 21, price: 25, daysAgo: 11 },
      { material: 'glass', item: 'Glass bottles', weight: 6, recycler: 22, price: 20, daysAgo: 4 }
    ]
    for (const [index, item] of historical.entries()) {
      const completedAt = new Date(Date.now() - item.daysAgo * 86400000)
      const createdAt = new Date(completedAt.getTime() - 2 * 86400000)
      const wasteItemId = id(30 + index)
      const requestId = id(40 + index)
      const payout = item.weight * item.price // Invented DEMO rule; no AI price calculation.
      await insertDemo(WasteItem, {
        _id: wasteItemId, userId: consumerId, imageUrl: 'https://example.invalid/recykle-demo-item.jpg',
        materialCode: item.material, itemName: item.item, recyclability: 'recyclable', confidence: 0.94,
        disposalMethod: 'Hand to recycler', preparationInstructions: ['Keep clean and dry'], hazardWarning: null,
        weightKg: item.weight, location: consumerPoint, estimatedValueMin: payout, estimatedValueMax: payout,
        currency: 'NGN', status: 'completed', isDemo: true, createdAt, updatedAt: completedAt
      })
      await insertDemo(Request, {
        _id: requestId, wasteItemId, userId: consumerId, recyclerId: id(item.recycler),
        pickupLocation: consumerPoint, requestedPickupTime: createdAt, acceptedAt: createdAt,
        completedAt, matchScore: 0.86, matchReasons: ['Demo nearby recycler', 'Demo material price'],
        distanceKm: 5.2, pricePerKg: item.price, expectedPayout: payout, status: 'completed',
        isDemo: true, createdAt, updatedAt: completedAt
      })
      await insertDemo(Transaction, {
        _id: id(50 + index), userId: consumerId, requestId, amount: payout,
        currency: 'NGN', type: 'recycling_reward', provider: 'mock', status: 'completed',
        isDemo: true, createdAt
      })
    }

    for (const model of [User, Recycler, WasteItem, Request, Transaction]) await verifyIndexes(model)
    const expectedRecords: Array<[Model<unknown>, number[]]> = [
      [User, [1, 2, 10, 11, 12, 13]],
      [Recycler, [20, 21, 22, 23]],
      [WasteItem, [30, 31, 32, 33]],
      [Request, [40, 41, 42, 43]],
      [Transaction, [50, 51, 52, 53]]
    ]
    for (const [model, ids] of expectedRecords) {
      const count = await model.countDocuments({ _id: { $in: ids.map(id) }, isDemo: true })
      if (count !== ids.length) throw new Error(`Demo record verification failed for ${model.modelName}`)
      console.log(`${model.modelName}: ${count} demo records verified`)
    }
    console.log('DEMO seed complete: 1 consumer, 1 waste operator, 4 fictional recyclers, 4 historical completed requests.')
  } finally {
    await mongoose.disconnect()
  }
}
