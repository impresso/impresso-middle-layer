import { ImpressoApplication } from '../../types.js'
import createService from './mentions.class.js'
import hooks from './mentions.hooks'

export default function (app: ImpressoApplication) {
  // Initialize our service with any options it requires
  app.use('/mentions', createService({ app }))

  // Get our initialized service so that we can register hooks
  const service = app.service('mentions')

  service.hooks(hooks)
}
