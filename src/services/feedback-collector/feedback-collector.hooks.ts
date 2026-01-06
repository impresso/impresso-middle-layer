import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    create: [validateWithSchema('services/feedback-collector/schema/create/payload.json')],
  },
}
