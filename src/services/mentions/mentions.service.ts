import { ImpressoApplication } from '@/types.js'
import createService from '@/services/mentions/mentions.class.js'
import hooks from '@/services/mentions/mentions.hooks.js'

export default async function (app: ImpressoApplication) {
  // Initialize our service with any options it requires
  app.use('/mentions', await createService({ app }))

  // Get our initialized service so that we can register hooks
  const service = app.service('mentions')

  service.hooks(hooks)
}
