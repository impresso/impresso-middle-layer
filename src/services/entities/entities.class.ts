import { ImpressoApplication } from '@/types.js'
import { Service as SequelizeService } from '@/services/sequelize.service.js'
import User from '@/models/users.model.js'
import { Params } from '@feathersjs/feathers'
import { Filter } from 'impresso-jscommons'
import { buildSequelizeWikidataIdFindEntitiesCondition, sortFindEntitiesFilters } from '@/services/entities/util.js'
import { EntityId, resolve as resolveWikidata } from '@/services/wikidata.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import Entity, { IEntitySolrHighlighting, suggestField } from '@/models/entities.model.js'

/* eslint-disable no-unused-vars */
import debugLib from 'debug'
const debug = debugLib('impresso/services:entities')
import lodash from 'lodash'
import { Op } from 'sequelize'
import { NotFound } from '@feathersjs/errors'

import { measureTime } from '@/util/instruments.js'
import { buildSearchEntitiesSolrQuery } from '@/services/entities/logic.js'

interface Sanitized<T> {
  sanitized: T
  originalQuery: any
}

interface WithUser {
  user?: User
}

interface FindQuery {
  filters: Filter[]
  limit?: number
  offset?: number
  order_by?: string
  resolve?: string
}

class Service {
  app: ImpressoApplication
  name: string
  sequelizeService: SequelizeService
  solr: SimpleSolrClient

  constructor({ app }: { app: ImpressoApplication }) {
    this.app = app
    this.name = 'entities'
    this.sequelizeService = new SequelizeService({
      app: app as any as null,
      name: this.name,
      cacheReads: true,
    })
    this.solr = app.service('simpleSolrClient')
  }

  async create(data: any, params: any) {
    params.query = data
    return this.find(params)
  }

  async find(params: Params<FindQuery> & Sanitized<FindQuery> & WithUser) {
    return await this._find(params)
  }

  async _find(params: Params<FindQuery> & Sanitized<FindQuery> & WithUser) {
    const qp = params.query!
    debug('[find] with params:', qp)

    // split filters into solr and sequelize filters
    const { solrFilters, sequelizeFilters } = sortFindEntitiesFilters(qp.filters)
    // build sequelize condition for wikidata IDs
    const sequelizeWikidataFindEntitiesCondition = buildSequelizeWikidataIdFindEntitiesCondition(sequelizeFilters)

    // if condition was built - run the query against the db
    // and collect matched entity ids
    let constraintIds: string[] | undefined = undefined
    if (sequelizeWikidataFindEntitiesCondition != null) {
      const records = await this.sequelizeService.find({
        findAllOnly: true,
        query: {
          limit: 1000000,
          offset: 0,
        },
        where: sequelizeWikidataFindEntitiesCondition,
      })

      constraintIds = records.data.map((d: any) => d.uid)
    }

    debug('[find] constraintIds:', constraintIds)

    // if ids were collected - add them as a filter for solr
    const uidFilter: Filter | undefined =
      constraintIds != null
        ? {
            type: 'uid',
            q: constraintIds,
          }
        : undefined

    const query = buildSearchEntitiesSolrQuery(
      {
        filters: uidFilter != null ? [uidFilter, ...solrFilters] : solrFilters,
        orderBy: qp.order_by,
        limit: qp.limit,
        offset: qp.offset,
      },
      this.app.get('solrConfiguration').namespaces ?? []
    )
    debug('[find] solr query:', query)

    const solrResult = await measureTime(
      () => this.solr.select(SolrNamespaces.Entities, { body: query }),
      'entities.find.solr.mentions'
    )

    const factory = Entity.solrFactory()
    const entities = solrResult.response?.docs?.map(factory)

    debug('[find] total entities:', solrResult.response?.numFound)
    // is Empty?
    if (!solrResult.response?.numFound) {
      return {
        total: 0,
        data: [],
        limit: qp.limit,
        offset: qp.offset,
        info: {
          ...params.originalQuery,
        },
      }
    }
    // generate the sequelize clause.
    const where = {
      id: {
        [Op.in]: entities?.map((d: any) => d.uid),
      },
    }
    // get sequelize results
    const sequelizeResult = await measureTime(
      () =>
        this.sequelizeService.find({
          findAllOnly: true,
          query: {
            limit: entities?.length,
            offset: 0,
          },
          where,
        }),
      'entities.find.db.entities'
    )

    // entities from sequelize, containing wikidata and dbpedia urls
    const sequelizeEntitiesIndex = lodash.keyBy(sequelizeResult.data, 'uid')
    const result = {
      total: solrResult.response?.numFound,
      limit: qp.limit,
      offset: qp.offset,
      data: entities?.map((d: any) => {
        if (sequelizeEntitiesIndex[d.uid]) {
          // enrich with wikidataID
          d.wikidataId = sequelizeEntitiesIndex[d.uid].wikidataId
        }

        // enrich with fragments, if any provided:
        const matches = (solrResult.highlighting?.[d.uid] as IEntitySolrHighlighting)?.[suggestField]
        if (matches) {
          d.matches = matches
        }
        return d
      }),
      info: {
        ...params.originalQuery,
      },
    }

    if (!params.sanitized.resolve) {
      // no need to resolve?
      debug('[find] completed, no param resolve, then SKIP wikidata.')
      return result
    }

    // get wikidata ids
    const wkdIds = lodash(sequelizeEntitiesIndex).map('wikidataId').compact().value() as EntityId[]

    debug('[find] wikidata loading:', wkdIds.length)
    const resolvedEntities = await resolveWikidata({
      ids: wkdIds,
      cache: this.app.service('redisClient').client,
    })

    result.data = result?.data?.map((d: any) => {
      if (d.wikidataId) {
        d.wikidata = resolvedEntities[d.wikidataId]?.toJSON()
      }
      return d
    })
    return result
  }

  async get(id: string, params: any) {
    const findParams = {
      ...params,
      sanitized: { ...params.sanitized, resolve: true },
      query: {
        resolve: true,
        limit: 1,
        filters: [
          {
            type: 'uid',
            // yes, entities id can have " in their name... check entities tests.
            q: `${id.split('"').join('*')}`, // no comment
          },
        ],
      },
    }
    return await this._find(findParams).then(res => {
      if (!res?.data?.length) {
        throw new NotFound()
      }
      return res.data[0]
    })
  }

  async update(id: string, data: any, params: any) {
    return data
  }

  async patch(id: string, data: any, params: any) {
    return data
  }

  async remove(id: string, params: any) {
    return { id }
  }
}

export default function (options: any) {
  return new Service(options)
}

export { Service }
