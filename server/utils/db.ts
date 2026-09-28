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
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 30_000
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
function isAppHttpError(error: unknown): error is { statusCode: number; statusMessage?: string } {
  return Boolean(error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number')
}

function isTransactionUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = mongoErrorCode(error)
  // 20 = IllegalOperation (common when transactions are unavailable)
  return code === 20
    || /replica set|Transaction numbers are only allowed|transactions are not supported|transaction numbers|illegal operation/i.test(message)
}

function mongoErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  if ('code' in error && typeof (error as { code: unknown }).code === 'number') {
    return (error as { code: number }).code
  }
  // Mongoose often wraps the driver error
  if ('cause' in error) return mongoErrorCode((error as { cause: unknown }).cause)
  if ('errorResponse' in error) return mongoErrorCode((error as { errorResponse: unknown }).errorResponse)
  return null
}

function safeDbFailureMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? 'unknown error')
  return raw
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, '[redacted-uri]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .slice(0, 180)
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

      const detail = safeDbFailureMessage(error)
      console.error('[recircle:db] transaction failed', detail)
      throw createError({
        statusCode: 503,
        statusMessage: `Database write failed: ${detail}`
      })
    }
    return result
  } finally {
    await session.endSession()
  }
}
