import { HookContext } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { validate } from '@/hooks/params.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'

const REGEX_EMAIL =
  // eslint-disable-next-line max-len
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

interface CreateData {
  email?: string
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    create: [
      validate<CreateData>(
        {
          email: {
            required: true,
            regex: REGEX_EMAIL,
            after: d => d?.trim(),
          },
        },
        'POST'
      ),
    ],
  },
}
