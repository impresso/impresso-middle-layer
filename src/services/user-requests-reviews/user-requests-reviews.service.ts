import { Service } from './user-requests-reviews.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'
import { queryWithCommonParams } from '../../hooks/params'

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
    '/user-requests-reviews',
    new Service({
      app,
      name: 'user-requests-reviews',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('user-requests-reviews')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
      find: [queryWithCommonParams()],
    },
    after: {
      find: [obfuscateProperties()],
      patch: [obfuscateProperties()],
    },
  })
}
