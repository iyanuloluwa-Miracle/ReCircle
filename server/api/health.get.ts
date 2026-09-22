import { defineEventHandler, setResponseStatus } from 'h3'
import type { HealthResponse } from '../../types'
import { getServerConfig } from '../utils/config'
import { connectDatabase } from '../utils/db'

export default defineEventHandler(async (event): Promise<HealthResponse> => {
  if (!getServerConfig().mongodbUri) {
    setResponseStatus(event, 503)
    return { status: 'error', database: 'not_configured' }
  }
  try {
    const mongoose = await connectDatabase()
    if (!mongoose.connection.db) throw new Error('Database not ready')
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 5000 })
    return { status: 'ok', database: 'connected' }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'error', database: 'unavailable' }
  }
})
