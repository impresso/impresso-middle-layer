import { Service } from './user-requests.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams } from '@/hooks/params.js'

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
    '/user-requests',
    new Service({
      app,
      name: 'user-requests',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('user-requests')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
      find: [queryWithCommonParams()],
      create: [],
    },
    after: {
      find: [],
    },
  })
}
