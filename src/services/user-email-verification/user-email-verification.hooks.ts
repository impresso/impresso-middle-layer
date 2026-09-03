import { validate } from '@/hooks/params.js'

interface CreateData {
  token?: string
}

export default {
  before: {
    create: [
      validate<CreateData>(
        {
          token: {
            required: true,
            regex: /^[A-Za-z0-9_-]+$/,
          },
        },
        'POST'
      ),
    ],
  },
}
