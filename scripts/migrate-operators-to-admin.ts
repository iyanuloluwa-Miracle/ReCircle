import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import mongoose from 'mongoose'
import { User } from '../server/models/User.ts'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is required to migrate legacy operator accounts.')
  process.exitCode = 1
} else {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 })
    const result = await User.collection.updateMany(
      { role: 'waste_operator' },
      { $set: { role: 'admin' } }
    )
    console.log(`Migrated ${result.modifiedCount} legacy operator account(s) to admin.`)
  } catch (error) {
    console.error(`Role migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
