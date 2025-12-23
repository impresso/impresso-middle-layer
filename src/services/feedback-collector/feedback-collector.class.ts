import { logger } from '@/logger.js'
import { SlimUser } from '@/authentication.js'
import { Params } from '@feathersjs/feathers'

interface FeedbackCollectorPayload {
  id: string
  issue: string
  content: string
  route: string
  errorMessages: {
    id: string
    message: string
  }[]
}

/* eslint-disable no-unused-vars */
export default class FeedbackCollector {
  async create(data: { errorMessages: any[]; sanitized: FeedbackCollectorPayload }, params: Params) {
    const user: SlimUser | undefined = (params as any).user
    const context = { ...data, userId: user?.uid, timestamp: new Date().toISOString() }
    const message = `[Feedback] ${JSON.stringify(context)}`
    logger.info(message)
  }
}
