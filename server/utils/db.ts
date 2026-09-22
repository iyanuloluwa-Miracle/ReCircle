import mongoose from 'mongoose'
import { createError } from 'h3'
import { getServerConfig } from './config'

mongoose.set('bufferCommands', false)
let connectionPromise: Promise<typeof mongoose> | undefined

/** Share concurrent connection attempts; a failed attempt can be retried. */
export async function connectDatabase() {
  const { mongodbUri } = getServerConfig()
  if (!mongodbUri) {
    throw createError({ statusCode: 503, statusMessage: 'Database is not configured' })
  }
  if (mongoose.connection.readyState === 1) return mongoose
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000
    }).finally(() => { connectionPromise = undefined })
  }
  try {
    return await connectionPromise
  } catch {
    // Never attach driver errors: these can contain connection details.
    throw createError({ statusCode: 503, statusMessage: 'Database is unavailable' })
  }
}
