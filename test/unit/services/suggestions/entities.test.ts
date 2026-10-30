import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import sinon from 'sinon'
import type { Configuration } from '@/configuration.js'
import type { ImpressoApplication } from '@/types.js'
import type { TermSuggestResponse } from '@/internalServices/simpleSolr.js'
import { Service } from '@/services/suggestions/suggestions.class.js'
import { SolrNamespaces } from '@/solr.js'
import Entity from '@/models/entities.model.js'

function setup(result: TermSuggestResponse) {
  const app: ImpressoApplication = feathers<ImpressoApplication['services'], Configuration>()
  const suggest = sinon.stub().callsFake((_namespace: unknown, request: { cfq?: string }) => {
    const suggestions =
      request.cfq == null
        ? result.suggestions
        : result.suggestions.filter(entry => entry.payload.endsWith(`|${request.cfq}`))
    return Promise.resolve({ ...result, numFound: suggestions.length, suggestions })
  })
  const client = {
    namespaces: SolrNamespaces,
    suggest,
    select: sinon.stub().rejects(new Error('Entity suggestions must use the suggester')),
    selectOne: sinon.stub(),
    sendBulkUpdateRequest: sinon.stub(),
    sendDeleteRequest: sinon.stub(),
    get: async () => undefined,
  }
  app.use('simpleSolrClient', client)
  return { service: new Service({ app, name: 'suggestions' }), suggest }
}

describe('v3 entity suggestions', () => {
  it('maps suggester entries and removes duplicate entities', async () => {
    const { service, suggest } = setup({
      numFound: 5,
      suggestions: [
        { term: '<b>Dev</b>on', weight: 83884, payload: 'Q23156|loc' },
        { term: '<b>Dev</b>on', weight: 83884, payload: 'Q23156|loc' },
        { term: '<b>Dev</b>on', weight: 83884, payload: 'Q23156|loc' },
        { term: 'Foreign, Commonwealth and <b>Dev</b>elopment Office', weight: 34509, payload: 'Q358834|org' },
      ],
    })
    const results = await service.get('entity', { query: { q: 'Dev' } })
    assert.deepEqual(JSON.parse(JSON.stringify(results)), [
      {
        q: 'Q23156',
        h: '<b>Dev</b>on',
        type: 'location',
        item: {
          id: 'Q23156',
          name: 'Devon',
          type: 'location',
          wikidataId: 'Q23156',
          countItems: 83884,
          countMentions: 0,
        },
        weight: 83884,
      },
      {
        q: 'Q358834',
        h: 'Foreign, Commonwealth and <b>Dev</b>elopment Office',
        type: 'organisation',
        item: {
          id: 'Q358834',
          name: 'Foreign, Commonwealth and Development Office',
          type: 'organisation',
          wikidataId: 'Q358834',
          countItems: 34509,
          countMentions: 0,
        },
        weight: 34509,
      },
    ])
    sinon.assert.calledOnceWithExactly(suggest, SolrNamespaces.Entities, {
      q: 'Dev',
      count: 12,
      dictionary: 'e_suggester_infix',
      cfq: undefined,
    })
  })

  for (const [type, cfq] of [
    ['person', 'pers'],
    ['location', 'loc'],
    ['organization', 'org'],
    ['organisation', 'org'],
    ['nag', 'pressagency'],
    ['newsagency', 'pressagency'],
    ['radiostation', 'radiostation'],
  ]) {
    it(`filters ${type} suggestions with cfq=${cfq}`, async () => {
      const { service, suggest } = setup({ numFound: 0, suggestions: [] })
      await service.get(type, { query: { q: 'Dev' } })
      sinon.assert.calledOnceWithMatch(suggest, SolrNamespaces.Entities, { cfq })
    })
  }

  it('returns at most three unique entities by default', async () => {
    const { service } = setup({
      numFound: 7,
      suggestions: Array.from({ length: 7 }, (_, i) => ({ term: `E${i}`, weight: 7 - i, payload: `Q${i}|pers` })),
    })
    const results = await service.suggestEntities({ q: 'E' })
    assert.deepEqual(
      results.map(r => r.q),
      ['Q0', 'Q1', 'Q2']
    )
  })

  it('skips entries with an unparseable payload', () => {
    const toEntity = Entity.solrSuggestFactory()
    assert.equal(toEntity({ term: 'X', weight: 1, payload: 'Q1' }), undefined)
    assert.equal(toEntity({ term: 'X', weight: 1, payload: 'Q1|unknown' }), undefined)
    assert.equal(toEntity({ term: 'X', weight: 1, payload: '|loc' }), undefined)
  })

  it('includes entity suggestions in the combined route', async () => {
    const { service } = setup({
      numFound: 1,
      suggestions: [{ term: '<b>Berl</b>in', weight: 123, payload: 'Q64|loc' }],
    })
    sinon.stub(service, 'suggestNewspapers').resolves([])
    sinon.stub(service, 'suggestTopics').resolves([])
    sinon.stub(service, 'suggestMentions').resolves([])
    const { data } = await service.find({ query: { q: 'Berl' } })
    assert.equal(data.length, 1)
    assert.equal(data[0].q, 'Q64')
    assert.equal(data[0].type, 'location')
    assert.equal(data[0].weight, 123)
  })

  it('returns no suggestions for an empty query without querying Solr', async () => {
    const { service, suggest } = setup({ numFound: 0, suggestions: [] })
    assert.deepEqual(await service.suggestEntities({ q: '  ' }), [])
    sinon.assert.notCalled(suggest)
  })
})
