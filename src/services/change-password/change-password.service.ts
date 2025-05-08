import { Service } from './change-password.class'
import { ImpressoApplication } from '../../types'
import { HookContext, ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround } from '../../hooks/authenticate'
import { REGEX_PASSWORD, validate } from '../../hooks/params'
import { BadRequest } from '@feathersjs/errors'

export default (app: ImpressoApplication) => {
  app.use(
    '/change-password',
    new Service({
      app,
      name: 'change-password',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('change-password')
  service.hooks({
    around: {
      all: [authenticateAround()],
    },
    before: {
      create: [
        // validate a JWT token using a regular expression
        validate(
          {
            currentPassword: {
              required: true,
              regex: REGEX_PASSWORD,
            },
            newPassword: {
              required: true,
              regex: REGEX_PASSWORD,
            },
            repeatNewPassword: {
              required: true,
              regex: REGEX_PASSWORD,
            },
          },
          'POST'
        ),
        (context: HookContext) => {
          const { newPassword, repeatNewPassword } = context.data
          if (newPassword !== repeatNewPassword) {
            throw new BadRequest('Passwords do not match')
          }
          return context
        },
      ],
    },
  })
}
