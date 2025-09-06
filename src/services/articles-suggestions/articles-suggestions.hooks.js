import { authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams, validate } from '../../hooks/params'

export default {
  before: {
    all: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
    find: [],
    get: [
      // give article id, we should provide the correct method
      validate({
        method: {
          choices: ['topics', 'topics_sqedist'],
          defaultValue: 'topics',
        },
        amount: {
          choices: ['2', '3'],
          defaultValue: '3',
          transform: d => parseInt(d, 10),
        },
      }),
      queryWithCommonParams(),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
