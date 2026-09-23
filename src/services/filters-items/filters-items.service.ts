// Initializes the `filters-items` service on path `/filters-items`
import { ImpressoApplication } from '@/types.js'
import { FiltersItems } from './filters-items.class.js'
import hooks from './filters-items.hooks.js'

export default function (app: ImpressoApplication) {
  app.use('/filters-items', new FiltersItems(app))
  app.service('filters-items').hooks(hooks)
}
