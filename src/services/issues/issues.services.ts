import { ImpressoApplication } from '../../types'

import createService from './issues.class'
import hooks from './issues.hooks'

export default function (app: ImpressoApplication) {
  app.use('/issues', createService({ app }))
  app.service('issues').hooks(hooks)
}
