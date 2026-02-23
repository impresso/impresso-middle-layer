import { UserSpecialMembershipRequestReviewsService as Service } from './user-special-membership-requests-reviews.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from './user-special-membership-requests-reviews.hooks.js'

export default (app: ImpressoApplication) => {
  app.use('/user-special-membership-requests-reviews', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-special-membership-requests-reviews')
  service.hooks(hooks)
}
