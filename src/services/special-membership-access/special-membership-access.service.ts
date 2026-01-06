import { SpecialMembershipAccessService as Service } from '@/services/special-membership-access/special-membership-access.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams } from '@/hooks/params.js'

export default async (app: ImpressoApplication) => {
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
