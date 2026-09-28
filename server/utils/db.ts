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

/** Run multi-document work inside a MongoDB transaction when the deployment supports it. */
function isAppHttpError(error: unknown): error is { statusCode: number } {
  return Boolean(error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number')
}

function isTransactionUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /replica set|Transaction numbers are only allowed|transactions are not supported|transaction numbers/i.test(message)
}

function mongoErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  if ('code' in error && typeof (error as { code: unknown }).code === 'number') {
    return (error as { code: number }).code
  }
  // Mongoose often wraps the driver error
  if ('cause' in error) return mongoErrorCode((error as { cause: unknown }).cause)
  if ('errorResponse' in error) return mongoErrorCode((error as { errorResponse: unknown }).errorResponse)
  return null
}

export async function withMongoTransaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  await connectDatabase()
  const session = await mongoose.startSession()
  try {
    let result!: T
    try {
      await session.withTransaction(async () => {
        result = await work(session)
      })
    } catch (error) {
      // Business-layer createError / H3 errors must keep their status codes.
      if (isAppHttpError(error)) throw error

      if (isTransactionUnsupported(error)) {
        throw createError({
          statusCode: 503,
          statusMessage: 'Database transactions require a replica set (MongoDB Atlas or a local rs).'
        })
      }

      if (mongoErrorCode(error) === 11000) {
        throw createError({
          statusCode: 409,
          statusMessage: 'A conflicting record already exists'
        })
      }

      console.error(
        '[recircle:db] transaction failed',
        error instanceof Error ? error.message : error
      )
      throw createError({ statusCode: 503, statusMessage: 'Database write failed' })
    }
    return result
  } finally {
    await session.endSession()
  }
}
