import { Service } from './account-details.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'

const obfuscateProperties = () => (context: any) => {
  if (context.result) {
    delete context.result.user_id
    delete context.result.id
    context.result = {
      ...context.result,
      user_uid: context.params.user.uid,
    }
  }
  return context
}

export default (app: ImpressoApplication) => {
  app.use(
    '/account-details',
    new Service({
      app,
      name: 'account-details',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('account-details')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
    },
    after: {
      find: [obfuscateProperties()],
      patch: [obfuscateProperties()],
    },
  })
}
