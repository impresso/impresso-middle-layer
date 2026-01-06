import { Service } from './user-change-plan-request.class.js'
import { ImpressoApplication } from '@/types.js'
import { HookContext, ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround } from '@/hooks/authenticate.js'
import { BadRequest } from '@feathersjs/errors'

export default (app: ImpressoApplication) => {
  app.use(
    '/user-change-plan-request',
    new Service({
      app,
      name: 'user-change-plan-request',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('user-change-plan-request')
  service.hooks({
    around: {
      all: [authenticateAround()],
    },
    before: {
      create: [
        (context: HookContext) => {
          const { plan } = context.data
          if (!plan || typeof plan !== 'string') {
            throw new BadRequest('`plan` param is required')
          }
          const availablePlans = context.app.get('availablePlans')

          if (!availablePlans.includes(plan)) {
            throw new BadRequest('Invalid plan, should be one of:', availablePlans)
          }
          return context
        },
      ],
    },
  })
}
