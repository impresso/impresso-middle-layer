import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import sinon from 'sinon'
import type { Configuration } from '@/configuration.js'
import type { ImpressoApplication } from '@/types.js'
import type { TermSuggestResponse } from '@/internalServices/simpleSolr.js'
import { Service } from '@/services/suggestions/suggestions.class.js'
import { SolrNamespaces } from '@/solr.js'
import Mention from '@/models/mentions.model.js'

function setup(result: TermSuggestResponse) {
  const app: ImpressoApplication = feathers<ImpressoApplication['services'], Configuration>()
  const suggest = sinon.stub().resolves(result)
  const client = {
    namespaces: SolrNamespaces,
    suggest,
    select: sinon.stub().rejects(new Error('Mention suggestions must use the suggester')),
    selectOne: sinon.stub(),
    sendBulkUpdateRequest: sinon.stub(),
    sendDeleteRequest: sinon.stub(),
    get: async () => undefined,
  }
  app.use('simpleSolrClient', client)
  return { service: new Service({ app, name: 'suggestions' }), suggest }
}

describe('v3 mention suggestions', () => {
  for (const [payload, type] of [
    ['pers', 'person'],
    ['loc', 'location'],
    ['org', 'organisation'],
    ['pressagency', 'newsagency'],
    ['radiostation', 'radiostation'],
  ]) {
    it(`maps ${payload} and preserves the response shape and occurrence weight`, async () => {
      const { service, suggest } = setup({
        numFound: 1,
        suggestions: [{ term: '<b>Rome</b>', payload, weight: 123 }],
      })
      const results = await service.get('mention', { query: { q: 'Rom' } })
      assert.deepEqual(JSON.parse(JSON.stringify(results)), [
        {
          q: 'Rome',
          h: '<b>Rome</b>',
          type: 'mention',
          item: { name: 'Rome', frequence: 123, type },
          weight: 123,
        },
      ])
      sinon.assert.calledOnceWithExactly(suggest, SolrNamespaces.Mentions, {
        q: 'Rom',
        count: 3,
        dictionary: 'm_suggester_infix',
      })
    })
  }

  it('retains separate suggestions for the same surface with different types', async () => {
    const { service } = setup({
      numFound: 2,
      suggestions: [
        { term: 'Paris', payload: 'loc', weight: 10 },
        { term: 'Paris', payload: 'pers', weight: 3 },
      ],
    })
    const results = await service.suggestMentions({ q: 'Par' })
    assert.deepEqual(
      results.map(result => [result.q, result.item?.type, result.weight]),
      [
        ['Paris', 'location', 10],
        ['Paris', 'person', 3],
      ]
    )
  })

  it('returns no suggestions for an empty query without querying Solr', async () => {
    const { service, suggest } = setup({ numFound: 0, suggestions: [] })
    assert.deepEqual(await service.suggestMentions({ q: '  ' }), [])
    sinon.assert.notCalled(suggest)
  })

  it('includes mention suggestions in the combined route', async () => {
    const { service } = setup({
      numFound: 1,
      suggestions: [{ term: 'Radio Paris', payload: 'radiostation', weight: 8 }],
    })
    sinon.stub(service, 'suggestNewspapers').resolves([])
    sinon.stub(service, 'suggestTopics').resolves([])
    sinon.stub(service, 'suggestEntities').resolves([])
    const { data } = await service.find({ query: { q: 'Radio' } })
    assert.equal(data.length, 1)
    assert.equal(data[0].type, 'mention')
    assert.equal(data[0].item.type, 'radiostation')
    assert.equal(data[0].weight, 8)
  })

  it('preserves zero weights and falls back for an unknown payload', () => {
    assert.deepEqual(
      Mention.solrFactory()({ term: 'Unknown', payload: 'unknown', weight: 0 }),
      new Mention({ name: 'Unknown', type: 'mention', frequence: 0 })
    )
  })

  it('returns an empty result when Solr has no matches', async () => {
    const { service } = setup({ numFound: 0, suggestions: [] })
    assert.deepEqual(await service.suggestMentions({ q: 'absent' }), [])
  })
})
