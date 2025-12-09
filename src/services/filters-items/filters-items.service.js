// Initializes the `filters-items` service on path `/filters-items`
import { FiltersItems } from './filters-items.class'
import hooks from './filters-items.hooks'

export default function (app) {
  app.use('/filters-items', new FiltersItems(app))
  app.service('filters-items').hooks(hooks)
}
