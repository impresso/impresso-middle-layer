import { UserEmailVerificationResendService as Service } from '@/services/user-email-verification-resend/user-email-verification-resend.class.js'
import hooks from '@/services/user-email-verification-resend/user-email-verification-resend.hooks.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default async (app: ImpressoApplication) => {
  app.use('/user-email-verification-resend', new Service(app), {
    events: [],
    methods: ['create'],
  } as ServiceOptions)

  const service = app.service('user-email-verification-resend')
  service.hooks(hooks)
}
