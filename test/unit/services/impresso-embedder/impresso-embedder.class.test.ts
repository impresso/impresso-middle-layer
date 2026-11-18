import { strict as assert } from 'assert'
import { BadRequest } from '@feathersjs/errors'
import type { IFetchClient } from '@/utils/http/client/base.js'
import {
  ImpressoImageEmbeddingService,
  ImpressoTextEmbeddingService,
  vectorToCanonicalEmbedding,
} from '@/services/impresso-embedder/impresso-embedder.class.js'

const BaseUrl = 'https://annotation.test/api'
const Vector = [0.5, 0.25]

interface RecordedRequest {
  url: string
  body: unknown
}

/**
 * Fetch client that records requests and always responds with `Vector`.
 */
class RecordingFetchClient implements IFetchClient {
  readonly requests: RecordedRequest[] = []

  async fetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
    this.requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ embedding: Vector }), { status: 200 })
  }
}

describe('ImpressoImageEmbeddingService', () => {
  const cases = [
    { searchTarget: 'image', model: undefined, path: '/dinov2/', tag: 'dinov2-1024' },
    { searchTarget: 'image', model: 'dinov2-1024', path: '/dinov2/', tag: 'dinov2-1024' },
    { searchTarget: 'multimodal', model: undefined, path: '/openclip-image/', tag: 'openclip-768' },
    { searchTarget: 'multimodal', model: 'openclip-768', path: '/openclip-image/', tag: 'openclip-768' },
    { searchTarget: 'multimodal', model: 'siglip2-768', path: '/siglip2-image/', tag: 'siglip2-768' },
  ] as const

  cases.forEach(({ searchTarget, model, path, tag }) => {
    it(`uses ${tag} for searchTarget=${searchTarget}, model=${model ?? '(default)'}`, async () => {
      const client = new RecordingFetchClient()
      const service = new ImpressoImageEmbeddingService({ baseUrl: BaseUrl, client })

      const result = await service.create({ searchTarget, bytes: 'abc', ...(model != null ? { model } : {}) })

      assert.deepEqual(client.requests, [{ url: `${BaseUrl}${path}`, body: { bytes: 'abc' } }])
      assert.equal(result.embedding, vectorToCanonicalEmbedding(Vector, tag))
    })
  })

  it('rejects a model that does not belong to the search target', async () => {
    const client = new RecordingFetchClient()
    const service = new ImpressoImageEmbeddingService({ baseUrl: BaseUrl, client })

    await assert.rejects(service.create({ searchTarget: 'image', model: 'siglip2-768', bytes: 'abc' }), BadRequest)
    assert.equal(client.requests.length, 0)
  })
})

describe('ImpressoTextEmbeddingService', () => {
  const cases = [
    { searchTarget: 'multimodal', model: undefined, path: '/openclip-text/', tag: 'openclip-768' },
    { searchTarget: 'multimodal', model: 'openclip-768', path: '/openclip-text/', tag: 'openclip-768' },
    { searchTarget: 'multimodal', model: 'siglip2-768', path: '/siglip2-text/', tag: 'siglip2-768' },
  ] as const

  cases.forEach(({ searchTarget, model, path, tag }) => {
    it(`uses ${tag} for searchTarget=${searchTarget}, model=${model ?? '(default)'}`, async () => {
      const client = new RecordingFetchClient()
      const service = new ImpressoTextEmbeddingService({ baseUrl: BaseUrl, client })

      const result = await service.create({ searchTarget, text: 'a building', ...(model != null ? { model } : {}) })

      assert.deepEqual(client.requests, [{ url: `${BaseUrl}${path}`, body: { data: 'a building' } }])
      assert.equal(result.embedding, vectorToCanonicalEmbedding(Vector, tag))
    })
  })

  it('uses the configured text model by default for searchTarget=text', async () => {
    const client = new RecordingFetchClient()
    const service = new ImpressoTextEmbeddingService({
      baseUrl: BaseUrl,
      client,
      embeddingsConfig: { textEmbeddings: { tag: 'gte-256' } },
    })

    const result = await service.create({ searchTarget: 'text', text: 'a building' })

    assert.deepEqual(client.requests, [
      { url: `${BaseUrl}/text-embedder/`, body: { data: 'a building', vector_dimensions: 256 } },
    ])
    assert.equal(result.embedding, vectorToCanonicalEmbedding(Vector, 'gte-256'))
  })

  it('accepts the configured text model when requested explicitly', async () => {
    const client = new RecordingFetchClient()
    const service = new ImpressoTextEmbeddingService({ baseUrl: BaseUrl, client })

    const result = await service.create({ searchTarget: 'text', model: 'gte-768', text: 'a building' })

    assert.equal(result.embedding, vectorToCanonicalEmbedding(Vector, 'gte-768'))
  })

  it('rejects a text model other than the configured one', async () => {
    const client = new RecordingFetchClient()
    const service = new ImpressoTextEmbeddingService({ baseUrl: BaseUrl, client })

    await assert.rejects(service.create({ searchTarget: 'text', model: 'gte-256', text: 'a building' }), BadRequest)
    assert.equal(client.requests.length, 0)
  })

  it('rejects a multimodal model for searchTarget=text', async () => {
    const client = new RecordingFetchClient()
    const service = new ImpressoTextEmbeddingService({ baseUrl: BaseUrl, client })

    await assert.rejects(service.create({ searchTarget: 'text', model: 'siglip2-768', text: 'a building' }), BadRequest)
    assert.equal(client.requests.length, 0)
  })
})
