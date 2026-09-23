import { SlimUser } from '@/authentication.js'
import { Params } from '@feathersjs/feathers'
import { getLogger } from '@/logger.js'

const logger = getLogger(['impresso', 'webapp'])

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
    const { errorMessage, ...rest } = context
    const extras = { ...rest, ...context }
    logger.error(`[Web App]: ${errorMessage}`, extras)
  }
}
