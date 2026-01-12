import { discard } from 'feathers-hooks-common'
import { REGEX_PASSWORD, validate } from '@/hooks/params.js'
import { validateWithSchema } from '@/hooks/schema.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'

interface UserUpdatePayload {
  pattern?: string
  firstname?: string
  lastname?: string
  email?: string
  displayName?: string
}

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
      validate<UserUpdatePayload>(
        {
          pattern: {
            regex: /^#[a-f0-9]{2,6}$/,
            after: d => (Array.isArray(d) ? d.join(',') : d),
          },
          firstname: {
            after: d => d?.trim(),
          },
          lastname: {
            after: d => d?.trim(),
          },
          email: {
            after: d => d?.trim(),
          },
          displayName: {
            after: d => d?.trim(),
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
