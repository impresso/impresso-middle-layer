// Initializes the `filters-items` service on path `/filters-items`
import { FiltersItems } from './filters-items.class.js'
import hooks from './filters-items.hooks.js'

export default function (app) {
  app.use('/filters-items', new FiltersItems(app))
  app.service('filters-items').hooks(hooks)
}
