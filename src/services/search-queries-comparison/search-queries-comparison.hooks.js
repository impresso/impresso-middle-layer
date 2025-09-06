import { hooks } from '@feathersjs/authentication-local'
import { authenticate } from '../../hooks/authenticate'
import { validateWithSchema } from '../../hooks/schema'

const { protect } = hooks

export default {
  before: {
    create: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validateWithSchema('services/search-queries-comparison/schema/post/payload.json'),
    ],
  },

  after: {
    create: [protect('content')],
  },
}
