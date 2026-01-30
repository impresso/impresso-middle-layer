import { validate, REGEX_EMAIL } from '@/hooks/params.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'

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
