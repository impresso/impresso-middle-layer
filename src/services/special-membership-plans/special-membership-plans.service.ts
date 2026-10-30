import { SpecialMembershipPlansService as Service } from '@/services/special-membership-plans/special-membership-plans.class.js'
import { ImpressoApplication } from '@/types.js'
import { optionsDisabledInPublicApi } from '@/hooks/public-api.js'
import hooks from '@/services/special-membership-plans/special-membership-plans.hooks.js'

export {
  validateBitmapPositionsQuery,
  validatePatchMetadata,
} from '@/services/special-membership-plans/special-membership-plans.hooks.js'

export default async (app: ImpressoApplication) => {
  app.use('/special-membership-plans', new Service(app), optionsDisabledInPublicApi(app))
  const service = app.service('special-membership-plans')
  service.hooks(hooks)
}
