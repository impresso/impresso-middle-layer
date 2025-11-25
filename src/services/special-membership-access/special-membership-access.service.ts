import { SpecialMembershipAccessService as Service } from './special-membership-access.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams } from '../../hooks/params'

export default (app: ImpressoApplication) => {
  app.use('/special-membership-access', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('special-membership-access')
  service.hooks({
    around: {
      all: [authenticate({ allowUnauthenticated: true })],
    },
    before: {
      find: [queryWithCommonParams()],
    },
  })
}
