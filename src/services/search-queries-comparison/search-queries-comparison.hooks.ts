import { hooks } from '@feathersjs/authentication-local'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'

const validationInstance = newAjvInstance([['services/search-queries-comparison/schema/post/payload.json', 'request']])

const { protect } = hooks

export default {
  around: {
    all: [
      authenticate({
        allowUnauthenticated: true,
      }),
    ],
  },
  before: {
    create: [validateWithSchema('request', validationInstance)],
  },

  after: {
    create: [protect('content')],
  },
}
