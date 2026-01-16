import { UserSpecialMembershipRequestService as Service } from './user-special-membership-requests.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams } from '@/hooks/params.js'

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
      find: [queryWithCommonParams()],
    },
  })
}
