import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs, IndexId } from './search-facets.schema'
import { SolrMappings } from '../../data/constants'
import { Service } from './search-facets.class'
import { getHooks } from './search-facets.hooks'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'

const SupportedIndexes: IndexId[] = Object.keys(SolrMappings).map(key => key.replace('_', '-')) as IndexId[]

export default (app: ImpressoApplication) => {
  // Initialize our service with any options it requires
  const isPublicApi = app.get('isPublicApi')

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
      docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(index) }),
    } as ServiceOptions)
    // Get our initialized service so that we can register hooks
    const service = app.service(`search-facets/${index}`)
    service.hooks(getHooks(index))
  })
}
