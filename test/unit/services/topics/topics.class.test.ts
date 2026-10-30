import { strict as assert } from 'assert'
import { Service, SanitizedParams } from '@/services/topics/topics.class.js'
import { buildSolrQuery, queryNodeToString } from '@/util/solr/queryBuilder.js'
import { SolrNamespaces } from '@/solr.js'
import type { ImpressoApplication } from '@/types.js'
import type { Filter } from '@/models/index.js'

const buildServiceWithCapturedSolr = () => {
  const capturedRequests: any[] = []
  const solr = {
    select: async (_namespace: unknown, { body }: { body: unknown }) => {
      capturedRequests.push(body)
      return {
        responseHeader: { QTime: 1 },
        response: { numFound: 0, docs: [] },
      }
    },
  }
  const app = {
    service: (name: string) => {
      if (name !== 'simpleSolrClient') {
        throw new Error(`unexpected app.service("${name}") call in test`)
      }
      return solr
    },
  }
  const service = new Service({ app: app as unknown as ImpressoApplication, name: 'topics' })
  return { service, capturedRequests }
}

describe('services/topics Service.find', () => {
  it('serialises object query nodes (e.g. a string filter) instead of sending [object Object] to Solr', async () => {
    const filters: Filter[] = [{ type: 'string', q: 'baltimore' }]
    const { query } = buildSolrQuery(filters, SolrNamespaces.Search, [], {})

    // the query builder produces a structured bool node for a scoring string filter
    // because the content_txt_ field prefix expands to multiple language fields
    assert.equal(typeof query, 'object', 'precondition: expected an object query node')

    const { service, capturedRequests } = buildServiceWithCapturedSolr()
    const params = {
      query: { limit: 10, offset: 0 },
      sanitized: { filters, sq: query } as SanitizedParams,
    }

    const result = await service.find(params as any)

    assert.equal(capturedRequests.length, 1, 'expected exactly one Solr select request')
    const request = capturedRequests[0]
    assert.ok(!String(request.query).includes('[object Object]'), `q must not contain [object Object], got: ${request.query}`)
    assert.equal(request.query, `(${queryNodeToString(query)})`)

    assert.deepEqual(result.data, [])
    assert.equal(result.total, 0)
  })

  it('serialises combined object query nodes from multiple scored filters', async () => {
    const filters: Filter[] = [
      { type: 'string', op: 'AND', q: 'baltimore' },
      { type: 'topic-string', q: 'tru' },
    ]
    const { query } = buildSolrQuery(filters, SolrNamespaces.Search, [], {})
    assert.equal(typeof query, 'object', 'precondition: expected an object query node')

    const { service, capturedRequests } = buildServiceWithCapturedSolr()
    const params = {
      query: { limit: 10, offset: 0 },
      sanitized: { filters, sq: query } as SanitizedParams,
    }

    await service.find(params as any)

    assert.equal(capturedRequests.length, 1)
    const request = capturedRequests[0]
    assert.ok(!String(request.query).includes('[object Object]'), `q must not contain [object Object], got: ${request.query}`)
    assert.equal(request.query, `(${queryNodeToString(query)})`)
  })
})
