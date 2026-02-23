import { UserSpecialMembershipRequestService as Service } from './user-special-membership-requests.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'
import { OrderItem } from 'sequelize'

interface Params {
  order_by?: OrderItem[]
  status?: string[]
}

export default (app: ImpressoApplication) => {
  app.use('/user-special-membership-requests', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-special-membership-requests')
  service.hooks({
    around: {
      all: [authenticate({ allowUnauthenticated: false })],
    },
    before: {
      find: [
        queryWithCommonParams(),
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
      ],
    },
  })
}
