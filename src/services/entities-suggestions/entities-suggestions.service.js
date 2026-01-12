// Initializes the `entities-suggestions` service on path `/entities-suggestions`
import { EntitiesSuggestions } from './entities-suggestions.class.js'
import hooks from './entities-suggestions.hooks.js'

export default function (app) {
  // Initialize our service with any options it requires
  app.use('/entities-suggestions', new EntitiesSuggestions(app))

  // Get our initialized service so that we can register hooks
  const service = app.service('entities-suggestions')

  service.hooks(hooks)
}
