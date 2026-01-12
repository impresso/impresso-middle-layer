import { logger } from '@/logger.js'
import { SlimUser } from '@/authentication.js'
import { Params } from '@feathersjs/feathers'

interface ErrorsCollectorPayload {
  id: string
  url: string
  errorMessage: string
  stackTrace?: string
  origin?: string
  className?: string
  type?: string
}

interface ErrorContext extends ErrorsCollectorPayload {
  userId?: string
  timestamp: string // ISO 8601
}

/* eslint-disable no-unused-vars */
export default class ErrorsCollector {
  async create(data: ErrorsCollectorPayload, params: Params) {
    const user: SlimUser | undefined = (params as any).user
    const context = { ...data, userId: user?.uid, timestamp: new Date().toISOString() }
    const message = `[WebApp Error] ${JSON.stringify(context)}`
    logger.error(message)
  }
}
