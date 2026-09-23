import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import { TextReusePassages } from '@/services/text-reuse-passages/text-reuse-passages.class.js'
import type { ImpressoApplication } from '@/types.js'

describe('TextReusePassages', () => {
  it('keeps query filters when using group_by collapse', async () => {
    let capturedSolrRequestBody: Record<string, any> | undefined
    const mockSolr = {
      namespaces: {
        TextReusePassages: 'tr_passages',
      },
      select: async (_namespace: string, { body }: { body: Record<string, any> }) => {
        capturedSolrRequestBody = body
        return { response: { docs: [], numFound: 0 } }
      },
    }

    const app: Pick<ImpressoApplication, 'service' | 'get'> = {
      service(name: string): any {
        if (name === 'simpleSolrClient') return mockSolr
        if (name === 'media-sources') return { getLookup: async () => ({}) }
        throw new Error(`Unexpected service request: ${name}`)
      },
      get(name: string): any {
        if (name === 'solrConfiguration') return { namespaces: {} }
        if (name === 'features') return {}
        return undefined
      },
    }

    const filters: Filter[] = [{ type: 'textReuseClusterSize', q: '2 TO 2' }]
    const service = new TextReusePassages(app as ImpressoApplication)
    await service.find({
      query: {
        filters,
        group_by: 'textReuseClusterId',
      },
    })

    assert.ok(capturedSolrRequestBody)
    assert.ok(Array.isArray(capturedSolrRequestBody.filter))
    assert.equal(capturedSolrRequestBody.filter.length, 2)
    assert.equal(capturedSolrRequestBody.filter[0], 'cluster_size_l:[2 TO 2]')
    assert.equal(capturedSolrRequestBody.filter[1], '{!collapse field=cluster_id_s max=ms(meta_date_dt)}')
  })
})
