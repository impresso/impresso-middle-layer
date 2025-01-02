import { ImpressoApplication } from '../../types'
import { Service as SequelizeService } from '../sequelize.service'
import User from '../../models/users.model'
import { Params } from '@feathersjs/feathers'
import { Filter } from 'impresso-jscommons'
import { buildSequelizeWikidataIdFindEntitiesCondition, sortFindEntitiesFilters } from './util'
import { IHuman, ILocation, resolve as resolveWikidata } from '../wikidata'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import { SolrNamespaces } from '../../solr'

/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:entities')
const lodash = require('lodash')
const { Op } = require('sequelize')
const { NotFound } = require('@feathersjs/errors')

const Entity = require('../../models/entities.model')
const { measureTime } = require('../../util/instruments')
const { buildSearchEntitiesSolrQuery } = require('./logic')

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

    const query = buildSearchEntitiesSolrQuery({
      filters: uidFilter != null ? [uidFilter, ...solrFilters] : solrFilters,
      orderBy: qp.order_by,
      limit: qp.limit,
      offset: qp.offset,
    })
    debug('[find] solr query:', query)

    const solrResult = await measureTime(
      () => this.solr.select(SolrNamespaces.Entities, { body: query }),
      'entities.find.solr.mentions'
    )

    const entities = solrResult.response.docs.map(Entity.solrFactory())

    debug('[find] total entities:', solrResult.response.numFound)
    // is Empty?
    if (!solrResult.response.numFound) {
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
        [Op.in]: entities.map((d: any) => d.uid),
      },
    }
    // get sequelize results
    const sequelizeResult = await measureTime(
      () =>
        this.sequelizeService.find({
          findAllOnly: true,
          query: {
            limit: entities.length,
            offset: 0,
          },
          where,
        }),
      'entities.find.db.entities'
    )

    // entities from sequelize, containing wikidata and dbpedia urls
    const sequelizeEntitiesIndex = lodash.keyBy(sequelizeResult.data, 'uid')
    const result = {
      total: solrResult.response.numFound,
      limit: qp.limit,
      offset: qp.offset,
      data: entities.map((d: any) => {
        if (sequelizeEntitiesIndex[d.uid]) {
          // enrich with wikidataID
          d.wikidataId = sequelizeEntitiesIndex[d.uid].wikidataId
        }

        // enrich with fragments, if any provided:
        if (solrResult.highlighting[d.uid].entitySuggest) {
          d.matches = solrResult.highlighting[d.uid].entitySuggest
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
    const wkdIds = lodash(sequelizeEntitiesIndex).map('wikidataId').compact().value()

    debug('[find] wikidata loading:', wkdIds.length)
    const resolvedEntities: Record<string, IHuman | ILocation> = {}

    return Promise.all(
      wkdIds.map((wkdId: string) =>
        measureTime(
          () =>
            resolveWikidata({
              ids: [wkdId],
              cache: this.app.service('redisClient').client,
            }).then(resolved => {
              resolvedEntities[wkdId] = resolved[wkdId]
            }),
          'entities.find.wikidata.get'
        )
      )
    )
      .then(res => {
        debug('[find] wikidata success!')
        result.data = result.data.map((d: any) => {
          if (d.wikidataId) {
            d.wikidata = resolvedEntities[d.wikidataId]
          }
          return d
        })
        return result
      })
      .catch(err => {
        console.error(err)
        return result
      })
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
      if (!res.data.length) {
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

module.exports = function (options: any) {
  return new Service(options)
}

module.exports.Service = Service
