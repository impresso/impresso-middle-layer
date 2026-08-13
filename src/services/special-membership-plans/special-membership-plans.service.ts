import { SpecialMembershipPlansService as Service } from '@/services/special-membership-plans/special-membership-plans.class.js'
import { ImpressoApplication } from '@/types.js'
import { HookContext, ServiceOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams } from '@/hooks/params.js'
import { BadRequest } from '@feathersjs/errors'
import { optionsDisabledInPublicApi } from '@/hooks/public-api.js'

export const validateBitmapPositionsQuery = () => async (context: HookContext) => {
  const bitmapPositions = context.params?.query?.bitmapPositions

  if (bitmapPositions == null) {
    return context
  }

  const rawValues = Array.isArray(bitmapPositions) ? bitmapPositions : [bitmapPositions]
  const normalizedValues = rawValues.flatMap(value =>
    typeof value === 'string' ? value.split(',').map(item => item.trim()) : [value]
  )

  if (
    normalizedValues.length === 0 ||
    normalizedValues.some(value => value === '' || !Number.isInteger(Number(value)))
  ) {
    throw new BadRequest('`bitmapPositions` must be an array of integers')
  }

  if (!context.params.sanitized) {
    context.params.sanitized = {}
  }

  context.params.sanitized.bitmapPositions = normalizedValues.map(value => Number(value))

  return context
}

export default async (app: ImpressoApplication) => {
  app.use('/special-membership-plans', new Service(app), optionsDisabledInPublicApi(app))
  const service = app.service('special-membership-plans')
  service.hooks({
    around: {
      all: [authenticate({ allowUnauthenticated: true })],
    },
    before: {
      find: [validateBitmapPositionsQuery(), queryWithCommonParams()],
    },
  })
}
