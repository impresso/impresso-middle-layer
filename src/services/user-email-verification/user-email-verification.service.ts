import { UserEmailVerificationService as Service } from '@/services/user-email-verification/user-email-verification.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from '@/services/user-email-verification/user-email-verification.hooks.js'

export default async (app: ImpressoApplication) => {
  app.use('/user-email-verification', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('user-email-verification')
  service.hooks(hooks)
}
