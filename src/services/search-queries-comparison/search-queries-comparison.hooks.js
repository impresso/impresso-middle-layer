import { hooks } from '@feathersjs/authentication-local'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'

const { protect } = hooks

export default {
  around: {
    all: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      })
    ]
  },
  before: {
    create: [
      validateWithSchema('services/search-queries-comparison/schema/post/payload.json'),
    ],
  },

  after: {
    create: [protect('content')],
  },
}
