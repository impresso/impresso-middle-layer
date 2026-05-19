import { strict as assert } from 'assert'
import { TextReusePassages } from '@/services/text-reuse-passages/text-reuse-passages.class.js'

describe('TextReusePassages', () => {
  it('keeps query filters when using group_by collapse', async () => {
    let selectBody: Record<string, any> | undefined
    const mockSolr = {
      namespaces: {
        TextReusePassages: 'tr_passages',
      },
      select: async (_namespace: string, { body }: { body: Record<string, any> }) => {
        selectBody = body
        return { response: { docs: [], numFound: 0 } }
      },
    }

    const app = {
      service(name: string) {
        if (name === 'simpleSolrClient') return mockSolr
        if (name === 'media-sources') return { getLookup: async () => ({}) }
        throw new Error(`Unexpected service request: ${name}`)
      },
      get(name: string) {
        if (name === 'solrConfiguration') return { namespaces: {} }
        if (name === 'features') return {}
        return undefined
      },
    }

    const service = new TextReusePassages(app as any)
    await service.find({
      query: {
        filters: [{ type: 'textReuseClusterSize', q: '2 TO 2' }] as any,
        group_by: 'textReuseClusterId',
      },
    })

    assert.ok(selectBody)
    assert.ok(Array.isArray(selectBody.filter))
    assert.equal(selectBody.filter.length, 2)
    assert.equal(selectBody.filter[0], 'cluster_size_l:[2 TO 2]')
    assert.equal(selectBody.filter[1], '{!collapse field=cluster_id_s max=ms(meta_date_dt)}')
  })
})
