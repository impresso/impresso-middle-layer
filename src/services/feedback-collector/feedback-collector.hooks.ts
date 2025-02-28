import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { validateWithSchema } from '../../hooks/schema'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    create: [validateWithSchema('services/feedback-collector/schema/create/payload.json')],
  },
}
