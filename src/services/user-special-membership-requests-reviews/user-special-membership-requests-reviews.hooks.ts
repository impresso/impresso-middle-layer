import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'
import { OrderItem } from 'sequelize'

interface Params {
  order_by: OrderItem[]
  status?: string[]
}

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate<Params>(
        {
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
        },
        'GET',
        { applyInPlace: true }
      ),
      queryWithCommonParams(),
    ],
  },
}
