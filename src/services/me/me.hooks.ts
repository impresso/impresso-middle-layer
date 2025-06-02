import { discard } from 'feathers-hooks-common'
import { REGEX_PASSWORD, validate } from '../../hooks/params'
import { validateWithSchema } from '../../hooks/schema'
import { authenticateAround as authenticate } from '../../hooks/authenticate'

export default {
  around: {
    all: [authenticate()],
  },
  before: {
    find: [],
    get: [],
    create: [],
    update: [
      validateWithSchema('services/me/schema/post/payload.json'),
      validate(
        {
          pattern: {
            regex: /^#[a-f0-9]{2,6}$/,
            after: (d: string | string[]) => (Array.isArray(d) ? d.join(',') : d),
          },
          firstname: {
            after: (d: string) => d.trim(),
          },
          lastname: {
            after: (d: string) => d.trim(),
          },
          email: {
            after: (d: string) => d.trim(),
          },
          displayName: {
            after: (d: string) => d.trim(),
          },
        },
        'POST'
      ),
    ],
    patch: [
      validate(
        {
          previousPassword: {
            required: false,
          },
          newPassword: {
            required: false,
            regex: REGEX_PASSWORD,
          },
        },
        'POST'
      ),
    ],
    remove: [],
  },

  after: {
    all: [discard('password')],
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
