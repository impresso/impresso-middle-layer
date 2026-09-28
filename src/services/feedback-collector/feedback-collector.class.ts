import { getLogger } from '@/logger.js'
import { SlimUser } from '@/authentication.js'
import { Params } from '@feathersjs/feathers'

const logger = getLogger(['impresso', 'services', 'feedback-collector'])

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

export default class FeedbackCollector {
  async create(
    data: { errorMessages?: { id?: string; name?: string; message?: string }[]; sanitized: FeedbackCollectorPayload },
    params: Params & { user?: SlimUser }
  ) {
    const { user } = params
    const context = { ...data, userId: user?.uid, timestamp: new Date().toISOString() }
    logger.info('[Feedback] {context}', { context })
  }
}
