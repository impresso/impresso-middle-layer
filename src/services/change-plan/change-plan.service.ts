import { Service } from './change-plan.class'
import { ImpressoApplication } from '../../types'
import { HookContext, ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround } from '../../hooks/authenticate'
import { REGEX_PASSWORD, validate } from '../../hooks/params'
import { BadRequest } from '@feathersjs/errors'

export default (app: ImpressoApplication) => {
  app.use(
    '/change-plan',
    new Service({
      app,
      name: 'change-plan',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('change-plan')
  service.hooks({
    around: {
      all: [authenticateAround()],
    },
    before: {
      create: [
        (context: HookContext) => {
          const { plan } = context.data
          if (!plan || typeof plan !== 'string') {
            throw new BadRequest('Plan is required')
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
