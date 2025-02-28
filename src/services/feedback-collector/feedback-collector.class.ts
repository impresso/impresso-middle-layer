import { logger } from '../../logger'
import { Params } from '@feathersjs/feathers'
import { SlimUser } from '../../authentication'

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
