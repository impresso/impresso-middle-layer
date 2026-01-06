import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { ImpressoImageEmbeddingService, ImpressoTextEmbeddingService } from './impresso-embedder.class.js'
import hooks from './impresso-embedder.hooks.js'
import { imageEmbedderDocs, textEmbedderDocs } from './impresso-embedder.schema.js'

export default (app: ImpressoApplication) => {
  const baseUrl = app.get('impressoNerServiceUrl') ?? 'https://impresso-annotation.epfl.ch/api'
  const imageService = new ImpressoImageEmbeddingService({ baseUrl })

  app.use('/tools/embedder/image', imageService, {
    events: [],
    methods: ['create'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: imageEmbedderDocs }),
  } as ServiceOptions)
  app.service('/tools/embedder/image').hooks(hooks)

  const textService = new ImpressoTextEmbeddingService({ baseUrl })

  app.use('/tools/embedder/text', textService, {
    events: [],
    methods: ['create'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: textEmbedderDocs }),
  } as ServiceOptions)
  app.service('/tools/embedder/text').hooks(hooks)
}
