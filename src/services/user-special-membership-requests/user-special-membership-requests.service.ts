import { UserSpecialMembershipRequestService as Service } from './user-special-membership-requests.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from '@/services/user-special-membership-requests/user-special-membership-requests.hooks.js'

export default (app: ImpressoApplication) => {
  app.use('/user-special-membership-requests', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-special-membership-requests')
  service.hooks(hooks)
}
