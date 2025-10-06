import { Params } from '@feathersjs/feathers'
import {
  ImpressoEmbeddingResponse,
  ImpressoImageEmbeddingRequest,
  ImpressoTextEmbeddingRequest,
} from '../../models/generated/shared'
import { IFetchClient } from '../../utils/http/client/base'
import { createFetchClient } from '../../utils/http/client'
import { sendDownstreamRequest } from '../../utils/downstream-service'

interface TextDownstreamRequest {
  data: string
}

interface ImageDownstreamRequest {
  bytes: string
}

interface DownstreamResponse {
  embedding: number[]
}

const textToDownstreamImageRequest = (data: ImpressoTextEmbeddingRequest): TextDownstreamRequest => ({
  data: data.text,
})

const imageToDownstreamImageRequest = (data: ImpressoImageEmbeddingRequest): ImageDownstreamRequest => ({
  bytes: data.bytes,
})

const textToDownstreamTextRequest = (data: ImpressoTextEmbeddingRequest): TextDownstreamRequest => ({
  data: data.text,
})

const numberVectorToBase64 = (vector: number[]): string => {
  const floatArray = new Float32Array(vector)
  return Buffer.from(floatArray.buffer).toString('base64')
}

const downstreamResponseToEmbeddingResponseBuilder =
  (model: string) =>
  (data: DownstreamResponse): ImpressoEmbeddingResponse => ({
    embedding: `${model}:${numberVectorToBase64(data.embedding)}`,
  })

export class ImpressoImageEmbeddingService {
  private readonly client: IFetchClient

  constructor(public options: { baseUrl: string }) {
    this.client = createFetchClient({})
  }

  async create(data: ImpressoImageEmbeddingRequest): Promise<ImpressoEmbeddingResponse> {
    if (data.searchTarget === 'image') {
      const url = `${this.options.baseUrl}/dinov2/`
      const body = imageToDownstreamImageRequest(data)
      return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder('dinov2-1024'))
    } else {
      throw new Error(`Unknown search target: ${data.searchTarget}`)
    }
  }
}

export class ImpressoTextEmbeddingService {
  private readonly client: IFetchClient

  constructor(public options: { baseUrl: string }) {
    this.client = createFetchClient({})
  }

  async create(data: ImpressoTextEmbeddingRequest): Promise<ImpressoEmbeddingResponse> {
    if (data.searchTarget === 'image') {
      const url = `${this.options.baseUrl}/openclip-text/`
      const body = textToDownstreamImageRequest(data)
      return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder('openclip-768'))
    } else if (data.searchTarget === 'text') {
      const url = `${this.options.baseUrl}/text-embedder/`
      const body = textToDownstreamTextRequest(data)
      return sendDownstreamRequest(this.client, url, body, downstreamResponseToEmbeddingResponseBuilder('gte-768'))
    } else {
      throw new Error(`Unknown search target: ${data.searchTarget}`)
    }
  }
}
