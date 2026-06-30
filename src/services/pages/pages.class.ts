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

const debug = debugLib('impresso/services:pages')

export interface FindQuery {
  limit?: number
  offset?: number
}

export type FindResult = FindResponse<Page>

export type IPagesService = Pick<ClientService<Page, unknown, unknown, FindResult>, 'find' | 'get'>

export class PagesService implements IPagesService {
  protected readonly solr: SimpleSolrClient
  protected readonly sequelizeService: SequelizeService

  constructor(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.sequelizeService = initSequelizeService({
      app,
      name: 'pages',
    })
  }

  async get(id: Id, _params?: Params): Promise<Page> {
    const request = {
      q: `page_id_ss:${id}`,
      fl: 'id',
      limit: 0,
    }

    const results = await Promise.all([
      asFindAll(this.solr, 'search', request),
      measureTime(
        () =>
          this.sequelizeService.get(id, {}).catch(err => {
            if (err.code === 404) {
              debug(`'get' (WARNING!) no page found using SequelizeService for page id ${id}`)
              return
            }
            throw err
          }),
        'pages.get.db.page'
      ),
    ])

    if ((results[0].response?.numFound ?? 0) === 0) {
      debug(`get: no articles found for page id ${id}`)
      throw new NotFound()
    }

    if (results[1]) {
      results[1].countArticles = results[0].response?.numFound ?? 0
      return results[1]
    }

    return new Page({
      id: String(id),
      countArticles: results[0].response?.numFound ?? 0,
    })
  }

  async find(params?: Params<FindQuery>): Promise<FindResult> {
    const result = await measureTime(() => this.sequelizeService.find(params ?? {}), 'pages.find.db.pages')

    const limit = params?.query?.limit ?? result.limit ?? 10
    const offset = params?.query?.offset ?? result.offset ?? 0

    return {
      data: result.data,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    }
  }
}
