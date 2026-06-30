import type { ClientService, Id, Params } from '@feathersjs/feathers'
import { NotFound } from '@feathersjs/errors'
import debugLib from 'debug'
import type { PublicFindResponse as FindResponse } from '@/models/common.js'
import Page from '@/models/pages.model.js'
import type { ImpressoApplication } from '@/types.js'
import type { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import initSequelizeService, { Service as SequelizeService } from '@/services/sequelize.service.js'
import { measureTime } from '@/util/instruments.js'
import { asFindAll } from '@/util/solr/adapters.js'
import { Op, OrderItem, Sequelize, type WhereOptions } from 'sequelize'

const debug = debugLib('impresso/services:pages')

export interface FindQuery {
  limit?: number
  offset?: number
  order_by?: OrderItem[]
  id?: string[]
  issue_id?: string[]
  num?: number[]
  hasCoords?: number[]
  hasErrors?: number[]
  iiif?: string[]
  mediaSourceId?: string[]
}

export type FindResult = FindResponse<Page>
export type IPagesService = Pick<ClientService<Page, unknown, unknown, FindResult>, 'find' | 'get'>

// Maps query keys directly to a sequelize `Op.in` filter on the same-named column.
const IN_FILTER_KEYS = ['id', 'issue_id', 'num', 'hasCoords', 'hasErrors', 'iiif'] as const

function buildWhere(query: FindQuery | undefined): WhereOptions {
  const conditions: WhereOptions[] = []

  for (const key of IN_FILTER_KEYS) {
    const value = query?.[key]
    if (Array.isArray(value) && value.length > 0) {
      conditions.push({ [key]: { [Op.in]: value } })
    }
  }

  if (Array.isArray(query?.mediaSourceId) && query.mediaSourceId.length > 0) {
    conditions.push({
      issue_id: { [Op.or]: query.mediaSourceId.map(id => ({ [Op.like]: `${id}-%` })) },
    })
  }

  if (conditions.length === 0) return {}
  return conditions.length === 1 ? conditions[0] : { [Op.and]: conditions }
}

export class PagesService implements IPagesService {
  protected readonly sequelizeClient: Sequelize

  protected readonly solr: SimpleSolrClient
  protected readonly sequelizeService: SequelizeService
  protected readonly dbModel: ReturnType<typeof Page.sequelize>

  constructor(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize

    this.sequelizeService = initSequelizeService({
      app,
      name: 'pages',
    })
    this.dbModel = Page.sequelize(this.sequelizeClient)
  }

  async get(id: Id, _params?: Params): Promise<Page> {
    const request = {
      q: `page_id_ss:${id}`,
      fl: 'id',
      limit: 0,
    }

    const [solrResult, page] = await Promise.all([
      asFindAll(this.solr, 'search', request),
      measureTime(
        () =>
          this.sequelizeService.get(id, {}).catch(err => {
            if (err.code === 404) {
              debug(`'get' (WARNING!) no page found using SequelizeService for page id ${id}`)
              return undefined
            }
            throw err
          }),
        'pages.get.db.page'
      ),
    ])

    const countArticles = solrResult.response?.numFound ?? 0
    if (countArticles === 0) {
      debug(`get: no articles found for page id ${id}`)
      throw new NotFound()
    }

    if (page) {
      page.countArticles = countArticles
      return page
    }

    return new Page({ id: String(id), countArticles })
  }

  async find(params?: Params<FindQuery>): Promise<FindResult> {
    const where = buildWhere(params?.query)
    const { limit = 10, offset = 0, order_by = [['id', 'ASC']] } = params?.query ?? {}

    const sequelizeParams = {
      ...(params ?? {}),
      ...(Object.keys(where).length > 0 ? { where } : {}),
    }
    const { rows, count: total } = await this.dbModel.findAndCountAll({
      limit,
      offset,
      where,
      order: order_by as OrderItem[],
    })
    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as Page),
    }
  }
}
