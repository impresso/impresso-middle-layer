import type { ImpressoApplication } from '@/types.js'
import { getLogger } from '@/logger.js'
import type { Params } from '@feathersjs/feathers'
import type { Filter } from 'impresso-jscommons'
import { resolve as resolveWikidata, type EntityId } from '@/services/wikidata.js'
import type { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import Entity, { type IEntitySolrHighlighting, suggestField } from '@/models/entities.model.js'
import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { buildSearchEntitiesSolrQuery } from './logic.js'

const logger = getLogger(['impresso', 'services', 'entities'])

interface FindQuery {
  filters?: Filter[]
  limit?: number
  offset?: number
  order_by?: string
  resolve?: boolean
}

type EntityParams = Params<FindQuery> & {
  sanitized?: FindQuery
  originalQuery?: Record<string, unknown>
}

const isQid = (id: string): id is Extract<EntityId, `Q${string}`> => /^Q[0-9]+$/.test(id)

export class Service {
  app: ImpressoApplication
  name = 'entities'
  solr: SimpleSolrClient

  constructor({ app }: { app: ImpressoApplication }) {
    this.app = app
    this.solr = app.service('simpleSolrClient')
  }

  async create(data: FindQuery, params: EntityParams = {}) {
    return this.find({ ...params, query: data })
  }

  async find(params: EntityParams) {
    return this._find(params)
  }

  async _find(params: EntityParams) {
    const qp = params.query ?? {}
    const query = buildSearchEntitiesSolrQuery(
      { filters: qp.filters ?? [], orderBy: qp.order_by, limit: qp.limit, offset: qp.offset },
      this.app.get('solrConfiguration').namespaces ?? [],
      this.app.get('features') ?? {}
    )
    const solrResult = await this.solr.select<EntitySolrDocumentV3>(SolrNamespaces.Entities, { body: query })
    const entities = (solrResult.response?.docs ?? []).map(Entity.solrFactory())
    for (const entity of entities) {
      const highlighting: IEntitySolrHighlighting | undefined = solrResult.highlighting?.[entity.id]
      const matches = highlighting?.[suggestField]
      if (matches) entity.matches = matches
    }
    const result = {
      total: solrResult.response?.numFound ?? 0,
      limit: qp.limit,
      offset: qp.offset,
      data: entities,
      info: { ...params.originalQuery },
    }
    if (!(params.sanitized?.resolve ?? qp.resolve) || entities.length === 0) return result

    const ids = entities.map(entity => entity.id).filter(isQid)
    logger.debug(`[find] wikidata loading: ${ids.length}`)
    const resolved = await resolveWikidata({ ids, cache: this.app.service('redisClient').client })
    for (const entity of entities) entity.wikidata = resolved[entity.id]?.toJSON()
    return result
  }

  async get(id: string, params: EntityParams = {}) {
    if (!isQid(id)) throw new BadRequest('Entity ID must be a Wikidata QID')
    const result = await this._find({
      ...params,
      sanitized: { ...params.sanitized, resolve: true },
      query: { limit: 1, resolve: true, filters: [{ type: 'uid', q: id }] },
    })
    if (result.data.length === 0) throw new NotFound()
    return result.data[0]
  }

  async update(id: string, data: unknown) {
    return data
  }

  async patch(id: string, data: unknown) {
    return data
  }

  async remove(id: string) {
    return { id }
  }
}

export default function (options: { app: ImpressoApplication }) {
  return new Service(options)
}
