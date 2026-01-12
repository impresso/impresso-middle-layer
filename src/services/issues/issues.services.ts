import { ImpressoApplication } from '@/types.js'

import createService from '@/services/issues/issues.class.js'
import hooks from '@/services/issues/issues.hooks.js'

export default function (app: ImpressoApplication) {
  app.use('/issues', createService({ app }))
  app.service('issues').hooks(hooks)
}
