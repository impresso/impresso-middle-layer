import { REGEX_EMAIL, validate } from '@/hooks/params.js'

interface CreateData {
  email?: string
}

export default {
  before: {
    create: [
      validate<CreateData>(
        {
          email: {
            required: true,
            regex: REGEX_EMAIL,
          },
        },
        'POST'
      ),
    ],
  },
}
