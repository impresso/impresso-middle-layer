import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getDocs, IndexId } from '@/services/search-facets/search-facets.schema.js'
import { SolrMappings } from '@/data/constants.js'
import { Service } from '@/services/search-facets/search-facets.class.js'
import { getHooks } from '@/services/search-facets/search-facets.hooks.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

const SupportedIndexes: IndexId[] = Object.keys(SolrMappings)
  .map(key => key.replace('_', '-'))
  .filter(key => key !== 'collection-items') as IndexId[]

export default async (app: ImpressoApplication) => {
  // Initialize our service with any options it requires
  const isPublicApi = app.get('isPublicApi') ?? false

  SupportedIndexes.forEach(index => {
    const svc = new Service({
      app,
      index,
      name: `search-facets-${index}`,
    })
    // not exposing find method in public API
    if (isPublicApi) {
      ;(svc as any).find = undefined
    }

    app.use(`search-facets/${index}`, svc, {
      events: [],
      docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(index, isPublicApi) }),
    } as ServiceOptions)
    // Get our initialized service so that we can register hooks
    const service = app.service(`search-facets/${index}`)
    service.hooks(getHooks(index))
  })
}
