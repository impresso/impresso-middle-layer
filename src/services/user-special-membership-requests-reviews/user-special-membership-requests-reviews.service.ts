import { UserSpecialMembershipRequestReviewsService as Service } from './user-special-membership-requests-reviews.class.js'
import { ImpressoApplication } from '@/types.js'
import { HookContext, ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'

export default (app: ImpressoApplication) => {
  app.use('/user-special-membership-requests-reviews', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-special-membership-requests-reviews')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
      find: [
        validate({
          status: {
            required: false,
            choices: ['pending', 'approved', 'rejected'],
          },
          order_by: utils.orderBy({
            values: {
              date: ['dateLastModified', 'ASC'],
              '-date': ['dateLastModified', 'DESC'],
            },
            defaultValue: 'date',
          }),
        }),
        queryWithCommonParams(),
      ],
    },
  })
}
