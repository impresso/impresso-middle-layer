import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'

const validationInstance = newAjvInstance([['services/feedback-collector/schema/create/payload.json', 'request']])

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    create: [validateWithSchema('request', validationInstance)],
  },
}
