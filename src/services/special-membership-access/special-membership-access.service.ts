import { SpecialMembershipAccessService as Service } from './special-membership-access.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams } from '../../hooks/params'

export default (app: ImpressoApplication) => {
  app.use('/special-membership-access', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('special-membership-access')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
      find: [queryWithCommonParams()],
    },
  })
}
