import { strict as assert } from 'assert'
import { feathers, type HookContext } from '@feathersjs/feathers'
import { FeathersError } from '@feathersjs/errors'
import { errorHandler } from '@/app.hooks.js'
import type { AppServices, ImpressoApplication } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { SolrError } from '@/util/solr/errors.js'

const makeContext = (error: Error): HookContext<ImpressoApplication> => {
  const app = feathers<AppServices, Configuration>()
  return {
    arguments: [],
    event: null,
    toJSON() {
      return this
    },
    app,
    path: 'search',
    method: 'find',
    type: 'error',
    params: { provider: 'rest', user: { uid: 'user' } },
    error,
    service: {},
  }
}

describe('errorHandler hook', () => {
  it('does not forward Solr error details to the client', () => {
    const solrMessage = 'undefined field text_reuse\n\tat org.apache.solr.SomeClass.method(SomeClass.java:42)'
    const ctx = makeContext(
      new SolrError(
        { code: 400, message: solrMessage, params: '{"query":"secret_field:value"}' },
        {
          requestUrl: 'https://solr.internal/solr/core/select',
          requestBody: '{"query":"secret_field:value"}',
          responseStatus: 400,
          responseBody: '{"error":{"msg":"undefined field text_reuse"}}',
        }
      )
    )

    errorHandler(ctx)

    assert.ok(ctx.error instanceof FeathersError)
    assert.equal(ctx.error.code, 418)
    assert.equal(ctx.error.message, 'Solr returned an error')
    assert.deepEqual(ctx.error.data, { code: 400, userId: 'user' })

    const serialized = JSON.stringify(ctx.error.toJSON())
    assert.doesNotMatch(serialized, /text_reuse/)
    assert.doesNotMatch(serialized, /secret_field/)
    assert.doesNotMatch(serialized, /solr\.internal/)
  })
})
