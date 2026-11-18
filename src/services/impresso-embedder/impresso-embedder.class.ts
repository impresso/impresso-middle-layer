import { BadRequest } from '@feathersjs/errors'
import { ImpressoImageEmbeddingRequest, ImpressoTextEmbeddingRequest } from '@/models/generated/app/requests.js'
import { ImpressoEmbeddingResponse } from '@/models/generated/app/responses.js'
import { IFetchClient } from '@/utils/http/client/base.js'
import { createFetchClient } from '@/utils/http/client/index.js'
import { sendDownstreamRequest } from '@/utils/downstream-service.js'
import { EmbeddingsConfig, TextEmbeddingsConfig } from '@/models/generated/app/configuration.js'
import { DefaultTextEmbeddingsConfig, getTextEmbeddingsDimensions } from '@/util/configuration.js'

interface TextDownstreamRequest {
  data: string
  vector_dimensions?: number
}

interface ImageDownstreamRequest {
  bytes: string
}

interface DownstreamResponse {
  embedding: number[]
}

const imageToDownstreamImageRequest = (data: ImpressoImageEmbeddingRequest): ImageDownstreamRequest => ({
  bytes: data.bytes,
})

const textToDownstreamTextRequest = (
  data: ImpressoTextEmbeddingRequest,
  embeddingTag?: TextEmbeddingsConfig['tag']
): TextDownstreamRequest => ({
  data: data.text,
  ...(embeddingTag != undefined
    ? {
        vector_dimensions: getTextEmbeddingsDimensions(embeddingTag),
      }
    : {}),
})

const numberVectorToBase64 = (vector: number[]): string => {
  const floatArray = new Float32Array(vector)
  return Buffer.from(floatArray.buffer).toString('base64')
}

export const vectorToCanonicalEmbedding = (vector: number[], modelTag: string): string => {
  return `${modelTag}:${numberVectorToBase64(vector)}`
}

const downstreamResponseToEmbeddingResponseBuilder =
  (model: string) =>
  (data: DownstreamResponse): ImpressoEmbeddingResponse => ({
    embedding: vectorToCanonicalEmbedding(data.embedding, model),
  })

type ImageSearchTarget = ImpressoImageEmbeddingRequest['searchTarget']
type ImageModel = NonNullable<ImpressoImageEmbeddingRequest['model']>
type TextModel = NonNullable<ImpressoTextEmbeddingRequest['model']>
type MultimodalModel = Extract<ImageModel, TextModel>

/**
 * Downstream (annotation service) endpoint paths for image embedding models.
 */
const ImageModelEndpoints = {
  'dinov2-1024': '/dinov2/',
  'openclip-768': '/openclip-image/',
  'siglip2-768': '/siglip2-image/',
} satisfies Record<ImageModel, string>

/**
 * Downstream (annotation service) endpoint paths for multimodal text embedding models.
 */
const MultimodalTextModelEndpoints = {
  'openclip-768': '/openclip-text/',
  'siglip2-768': '/siglip2-text/',
} satisfies Record<MultimodalModel, string>

/**
 * Models available for each image search target. The first model is the default.
 */
const ImageSearchTargetModels = {
  image: ['dinov2-1024'],
  multimodal: ['openclip-768', 'siglip2-768'],
} satisfies Record<ImageSearchTarget, [ImageModel, ...ImageModel[]]>

/**
 * Multimodal models available for text embeddings. The first model is the default.
 */
const MultimodalTextModels = ['openclip-768', 'siglip2-768'] satisfies [MultimodalModel, ...MultimodalModel[]]

/**
 * Resolves the model to use: the requested one if it is supported, or the default (first) one.
 * Throws `BadRequest` if the requested model is not supported for the search target.
 */
const resolveModel = <M extends string>(
  searchTarget: string,
  supportedModels: readonly [M, ...M[]],
  requestedModel?: string
): M => {
  if (requestedModel == null) return supportedModels[0]
  const model = supportedModels.find(m => m === requestedModel)
  if (model == null) {
    throw new BadRequest(
      `Model "${requestedModel}" is not supported for search target "${searchTarget}". Supported models: ${supportedModels.join(', ')}`
    )
  }
  return model
}

export class ImpressoImageEmbeddingService {
  private readonly client: IFetchClient

  constructor(public options: { baseUrl: string; client?: IFetchClient }) {
    this.client = options.client ?? createFetchClient({})
  }

  async create(data: ImpressoImageEmbeddingRequest): Promise<ImpressoEmbeddingResponse> {
    const supportedModels: readonly [ImageModel, ...ImageModel[]] | undefined =
      ImageSearchTargetModels[data.searchTarget]
    if (supportedModels == null) throw new BadRequest(`Unknown search target: ${data.searchTarget}`)

    const model = resolveModel(data.searchTarget, supportedModels, data.model)
    const url = `${this.options.baseUrl}${ImageModelEndpoints[model]}`
    const body = imageToDownstreamImageRequest(data)
    return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder(model))
  }
}

export class ImpressoTextEmbeddingService {
  private readonly client: IFetchClient
  private readonly embeddingsConfig?: EmbeddingsConfig

  constructor(public options: { baseUrl: string; embeddingsConfig?: EmbeddingsConfig; client?: IFetchClient }) {
    this.client = options.client ?? createFetchClient({})
    this.embeddingsConfig = options.embeddingsConfig
  }

  async create(data: ImpressoTextEmbeddingRequest): Promise<ImpressoEmbeddingResponse> {
    const { searchTarget } = data
    if (searchTarget === 'multimodal') {
      const model = resolveModel(searchTarget, MultimodalTextModels, data.model)
      const url = `${this.options.baseUrl}${MultimodalTextModelEndpoints[model]}`
      const body = textToDownstreamTextRequest(data)
      return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder(model))
    } else if (searchTarget === 'text') {
      const configuredTag = this.embeddingsConfig?.textEmbeddings?.tag ?? DefaultTextEmbeddingsConfig.tag
      // Only the configured text model is supported: its vectors are the ones indexed in Solr.
      const modelTag = resolveModel(searchTarget, [configuredTag], data.model)
      const url = `${this.options.baseUrl}/text-embedder/`
      const body = textToDownstreamTextRequest(data, modelTag)
      return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder(modelTag))
    } else {
      throw new BadRequest(`Unknown search target: ${searchTarget}`)
    }
  }
}
