import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import sinon from 'sinon'
import type { ImpressoApplication } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'
import Entity from '@/models/entities.model.js'
import { transformEntityDetails } from '@/transformers/entity.js'
import { Service as EntitiesService } from '@/services/entities/entities.class.js'
import { Service as SuggestionsService } from '@/services/suggestions/suggestions.class.js'
import { createEntityResolver, findEntitiesByIds } from '@/services/entities/lookup.js'
import { entityExtractor } from '@/services/filters-items/extractors.js'
import { SolrNamespaces } from '@/solr.js'
import { withEntityLabels } from '@/services/content-items/content-items.class.js'
import { buildSearchEntitiesSolrQuery } from '@/services/entities/logic.js'

const document: EntitySolrDocumentV3 = {
  id: 'Q64',
  default_label_s: 'Berlin_(city)',
  label_fr_s: 'Berlin',
  label_de_s: 'Berlin',
  label_en_s: 'Berlin',
  label_other_s: 'Berlin',
  ner_entity_type_s: 'loc',
  content_item_count_l: 123,
  mention_count_l: 456,
  ner_type_loc_count_l: 400,
}

function setup(docs: EntitySolrDocumentV3[] = [document]) {
  const app: ImpressoApplication = feathers<ImpressoApplication['services'], Configuration>()
  app.set('solrConfiguration', { servers: [], namespaces: [] })
  const select = sinon.stub().resolves({
    response: { docs, numFound: docs.length, start: 0 },
    highlighting: { Q64: { entitySuggest: ['<b>Berlin</b>'] } },
  })
  const suggest = sinon.stub().rejects(new Error('Entity suggester must not be used'))
  const client = {
    namespaces: SolrNamespaces,
    select,
    suggest,
    selectOne: sinon.stub(),
    sendBulkUpdateRequest: sinon.stub(),
    sendDeleteRequest: sinon.stub(),
    get: async () => undefined,
  }
  app.use('simpleSolrClient', client)
  return { app, select, suggest }
}

describe('v3 entities', () => {
  it('preserves explicit labels and API totals, and excludes per-type counts', () => {
    const entity = Entity.solrFactory()(document)
    assert.equal(entity.name, 'Berlin_(city)')
    assert.equal(entity.type, 'location')
    assert.equal(entity.wikidataId, 'Q64')
    assert.equal(entity.countMentions, 456)
    assert.deepEqual(transformEntityDetails(entity), {
      id: 'Q64',
      label: 'Berlin_(city)',
      totalContentItems: 123,
      totalMentions: 456,
      type: 'location',
      wikidataId: 'Q64',
      wikidataDetails: undefined,
    })
    assert.equal('ner_type_loc_count_l' in entity, false)
  })

  it('maps agencies and radio stations, and handles absent optional totals', () => {
    const entity = Entity.solrFactory()({ ...document, ner_entity_type_s: 'pressagency', mention_count_l: undefined })
    assert.equal(entity.type, 'newsagency')
    assert.equal(entity.countMentions, 0)
    assert.equal(Entity.solrFactory()({ ...document, ner_entity_type_s: 'radiostation' }).type, 'radiostation')
  })

  it('finds QIDs and Wikidata filters without any database service', async () => {
    const { app, select } = setup()
    const result = await new EntitiesService({ app }).find({
      query: { filters: [{ type: 'wikidataId', q: 'Q64' }], limit: 10, offset: 0 },
    })
    assert.equal(result.total, 1)
    assert.equal(result.data[0].matches?.[0], '<b>Berlin</b>')
    assert.deepEqual(select.firstCall.args[1].body.filter, ['id:Q64'])
    await assert.rejects(new EntitiesService({ app }).get('2-54-Berlin'), /Wikidata QID/)
  })

  it('preserves exclusion and type-array semantics in Solr filters', () => {
    const query = buildSearchEntitiesSolrQuery(
      {
        filters: [
          { type: 'wikidataId', q: ['Q64', 'Q90'], context: 'exclude' },
          { type: 'type', q: ['newsagency', 'radiostation'] },
        ],
      },
      [],
      {}
    )
    assert.deepEqual(query.filter?.[0], {
      bool: {
        should: ['ner_entity_type_s:pressagency', 'ner_entity_type_s:radiostation'],
        minimum_should_match: 1,
      },
    })
    assert.ok(JSON.stringify(query.filter?.[1]).includes('must_not'))
  })

  it('uses select for typed autocomplete, filtering the primary type and ordering by its count', async () => {
    const { app, select, suggest } = setup()
    const service = new SuggestionsService({ app, name: 'suggestions' })
    const results = await service.get('location', { query: { q: 'Berl' } })
    const body = select.firstCall.args[1].body
    assert.equal(body.query, 'entitySuggest:Berl*')
    assert.deepEqual(body.filter, ['ner_entity_type_s:loc'])
    assert.equal(body.sort, 'def(ner_type_loc_count_l,0) DESC,def(mention_count_l,0) DESC,id ASC')
    assert.equal(body.limit, 3)
    assert.equal(results[0].q, 'Q64')
    assert.equal(results[0].h, '<b>Berlin</b>')
    assert.equal(results[0].weight, 400)
    assert.equal(suggest.called, false)
  })

  it('reenables entities in combined suggestions and falls back to default labels', async () => {
    const { app, select } = setup()
    select.resolves({ response: { docs: [document], numFound: 1, start: 0 } })
    const service = new SuggestionsService({ app, name: 'suggestions' })
    sinon.stub(service, 'suggestNewspapers').resolves([])
    sinon.stub(service, 'suggestTopics').resolves([])
    sinon.stub(service, 'suggestMentions').resolves([])
    const result = await service.find({ query: { q: 'Berl' } })
    assert.equal(result.data[0].q, 'Q64')
    assert.equal(result.data[0].h, document.default_label_s)
    assert.equal(result.data[0].weight, document.content_item_count_l)
  })

  it('batches concurrent and duplicate QID lookups', async () => {
    const { app, select } = setup()
    const resolve = createEntityResolver(app)
    const entities = await Promise.all([resolve('Q64'), resolve('Q64'), resolve('Q90')])
    assert.equal(select.callCount, 1)
    assert.equal(entities[0]?.name, document.default_label_s)
    assert.equal(entities[2], undefined)
    assert.deepEqual(await findEntitiesByIds(app, []), [])
    assert.equal(select.callCount, 1)
  })

  it('extracts QID entities using labels and types from Solr', async () => {
    const { app, select } = setup()
    const entities = await entityExtractor({ q: ['Q64', 'Q90'] }, app)
    assert.equal(select.callCount, 1)
    assert.equal(entities.length, 1)
    assert.equal(entities[0].type, 'location')
    assert.equal(entities[0].name, document.default_label_s)
  })
  it('enriches content-item labels while preserving their occurrence counts and groups', async () => {
    const enrich = withEntityLabels(new Map([['Q64', Entity.solrFactory()(document)]]))
    const item = await enrich({
      id: 'test',
      semanticEnrichments: {
        namedEntities: { locations: [{ id: 'Q64', count: 2, label: 'Q64' }] },
      },
    })
    assert.deepEqual(item.semanticEnrichments?.namedEntities?.locations, [
      { id: 'Q64', count: 2, label: document.default_label_s },
    ])
  })

  it('splits large entity lookups into bounded batches', async () => {
    const { app, select } = setup([])
    await findEntitiesByIds(
      app,
      Array.from({ length: 501 }, (_, i) => `Q${i + 1}`)
    )
    assert.equal(select.callCount, 2)
    assert.equal(select.firstCall.args[1].body.limit, 500)
    assert.equal(select.secondCall.args[1].body.limit, 1)
  })

  it('rejects every pending resolver on a Solr error and permits later requests', async () => {
    const { app, select } = setup()
    select.onFirstCall().rejects(new Error('Solr unavailable'))
    const resolve = createEntityResolver(app)
    const results = await Promise.allSettled([resolve('Q64'), resolve('Q90')])
    assert.ok(results.every(result => result.status === 'rejected'))
    assert.equal((await resolve('Q64'))?.name, document.default_label_s)
  })
})
