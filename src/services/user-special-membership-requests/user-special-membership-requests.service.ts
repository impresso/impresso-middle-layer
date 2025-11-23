import { UserSpecialMembershipRequestService as Service } from './user-special-membership-requests.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams } from '../../hooks/params'

export default (app: ImpressoApplication) => {
  app.use('/user-special-membership-requests', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-special-membership-requests')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
      find: [queryWithCommonParams()],
    },
  })
}
