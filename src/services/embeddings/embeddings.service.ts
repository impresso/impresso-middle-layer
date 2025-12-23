import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { logger } from '@/logger.js'
import { SolrNamespaces } from '@/solr.js'
import { ImpressoApplication } from '@/types.js'
import { createService as createV1Service } from './embeddings-v1.class.js'
import hooksv1 from './embeddings-v1.hooks.js'
import { EmbeddingsService } from './embeddings.class.js'
import hooks from './embeddings.hooks.js'
import { getDocs } from './embeddings.schema.js'

function hasWordEmbeddingsIndex(app: ImpressoApplication): boolean {
  const namespaces = app.get('solrConfiguration').namespaces ?? []
  return namespaces.find(({ namespaceId }) => namespaceId === SolrNamespaces.WordEmbeddings) != null
}

function hasLanguageSpecificEmbeddingsIndices(app: ImpressoApplication): boolean {
  const namespaces = app.get('solrConfiguration').namespaces ?? []
  return ['de', 'fr', 'lb'].some(
    lang => namespaces.find(({ namespaceId }) => namespaceId === `embeddings_${lang}`) != null
  )
}

interface ServiceConfig {
  service: any
  hooks: any
}

function getEmbeddingsServiceConfig(app: ImpressoApplication): ServiceConfig {
  if (hasWordEmbeddingsIndex(app)) {
    logger.info('Using embeddings service v2')
    return {
      service: new EmbeddingsService({ app }),
      hooks,
    }
  }

  if (hasLanguageSpecificEmbeddingsIndices(app)) {
    logger.info('Using embeddings service v1')
    return {
      service: createV1Service({ app, name: 'embeddings' }),
      hooks: hooksv1,
    }
  }

  throw new Error(
    'No word embeddings indices are configured. Please configure either word_embeddings index or embeddings_<lang_code> indices.'
  )
}

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  const { service, hooks } = getEmbeddingsServiceConfig(app)
  app.use('/embeddings', service, {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('embeddings').hooks(hooks)
}
