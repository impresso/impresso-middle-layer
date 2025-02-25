import { ImpressoApplication } from '../../types'
import { createService } from './embeddings-v1.class'
import hooks from './embeddings-v1.hooks'

export default function (app: ImpressoApplication): void {
  // Initialize our service with any options it requires
  app.use(
    '/embeddings',
    createService({
      app,
      name: 'embeddings',
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('embeddings')

  service.hooks(hooks)
}
