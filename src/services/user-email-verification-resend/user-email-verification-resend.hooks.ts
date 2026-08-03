import { validate } from '@/hooks/params.js'

interface CreateData {
  email?: string
}

const EMAIL_REGEX =
  // eslint-disable-next-line max-len
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export default {
  before: {
    create: [
      validate<CreateData>(
        {
          email: {
            required: true,
            regex: EMAIL_REGEX,
          },
        },
        'POST'
      ),
    ],
  },
}
