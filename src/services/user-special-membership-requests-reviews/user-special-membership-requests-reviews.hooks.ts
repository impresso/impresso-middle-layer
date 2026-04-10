import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'
import { FindQuery } from './user-special-membership-requests-reviews.class.js'

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate<FindQuery>(
        {
          limit: {
            required: false,
          },
          offset: {
            required: false,
          },
          order_by: {
            required: false,
            choices: ['-dateLastModified', 'dateLastModified'],
            transform: (d: string | string[] | undefined) => {
              if (!d) return undefined
              const value = Array.isArray(d) ? d[0] : d
              return utils.translate(value, {
                '-dateLastModified': [['dateLastModified', 'DESC']],
                dateLastModified: [['dateLastModified', 'ASC']],
              })
            },
          },
          status: {
            required: false,
            choices: ['pending', 'approved', 'rejected'],
          },
          term: {
            required: false,
            regex: /^[\p{L}\p{N}\s\p{P}]*$/u,
            max_length: 100,
          },
        },
        'GET',
        { applyInPlace: true }
      ),
      queryWithCommonParams(),
    ],
  },
}
