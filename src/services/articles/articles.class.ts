import { keyBy } from 'lodash'
import Debug from 'debug'
import { Op } from 'sequelize'
import { NotFound } from '@feathersjs/errors'

import initSequelizeService, { Service as SequelizeService } from '../sequelize.service'
import initSolrService, { Service as SolrService } from '../solr.service'
import Article from '../../models/articles.model'
import Issue from '../../models/issues.model'
import { measureTime } from '../../util/instruments'
import { ImpressoApplication } from '../../types'
import { SlimUser } from '../../authentication'

const debug = Debug('impresso/services:articles')

async function getIssues(request: Record<string, any>, app: ImpressoApplication) {
  const sequelize = app.get('sequelizeClient')
  const cacheManager = app.get('cacheManager')
  const cacheKey = initSequelizeService.getCacheKeyForReadSqlRequest(request, 'issues')

  return cacheManager
    .wrap(cacheKey, async () =>
      Issue.sequelize(sequelize)
        .findAll(request)
        .then((rows: any[]) => rows.map(d => d.get()))
    )
    .then(rows => keyBy(rows, 'uid'))
}

interface ServiceOptions {
  name?: string
  app?: ImpressoApplication
}

interface FindOptions {
  query: {
    filters?: any[]

    // things needed by SolService.find
    sq?: string
    sfq?: string
    limit?: number
    offset?: number
    facets?: string[]
    order_by?: string
    highlight_by?: boolean
    collapse_by?: string
    collapse_fn?: string
    requestOriginalPath?: boolean
  }
  user: SlimUser

  // things needed by SolService.find
  fl?: string[]
}

export class Service {
  name: string
  app?: ImpressoApplication
  SequelizeService: SequelizeService
  SolrService: SolrService

  constructor({ name = '', app = undefined }: ServiceOptions = {}) {
    this.name = String(name)
    this.app = app
    this.SequelizeService = initSequelizeService({
      app,
      name,
      cacheReads: true,
    })
    this.SolrService = initSolrService({
      app,
      name,
      namespace: 'search',
    })
  }

  async find(params: any) {
    return await this._find(params)
  }

  async findInternal(params: any) {
    return await this._find(params)
  }

  async _find(params: FindOptions) {
    const fl = Article.ARTICLE_SOLR_FL_LIST_ITEM
    const pageUids = (params.query.filters || []).filter(d => d.type === 'page').map(d => d.q)

    debug('[find] use auth user:', params.user ? params.user.uid : 'no user')
    // if(params.isSafe query.filters)
    const results = await measureTime(
      () =>
        this.SolrService.find({
          ...params,
          fl,
        }),
      'articles.find.solr'
    )

    // go out if there's nothing to do.
    if (results.total === 0) {
      return results
    }

    // add newspapers and other things from this class sequelize method
    const getAddonsPromise = measureTime(
      () =>
        this.SequelizeService.find({
          ...params,
          scope: 'get',
          where: {
            uid: { [Op.in]: results.data.map((d: { uid: string }) => d.uid) },
          },
          limit: results.data.length,
          order_by: [['uid', 'DESC']],
        })
          .catch(err => {
            console.error(err)
            return { data: [] }
          })
          .then(({ data }) => keyBy(data, 'uid')),
      'articles.find.db.articles'
    )

    // get accessRights from issues table
    const issuesRequest = {
      attributes: ['accessRights', 'uid'],
      where: {
        uid: { [Op.in]: results.data.map((d: any) => d.issue.uid) },
      },
    }
    const getRelatedIssuesPromise = measureTime(() => getIssues(issuesRequest, this.app!), 'articles.find.db.issues')

    // do the loop
    return Promise.all([getAddonsPromise, getRelatedIssuesPromise]).then(([addonsIndex, issuesIndex]) => ({
      ...results,
      data: results.data.map((article: Article) => {
        if (article?.issue?.uid != null && issuesIndex[article?.issue?.uid]) {
          article.issue.accessRights = issuesIndex[article.issue.uid].accessRights
        }
        if (!addonsIndex[article.uid]) {
          debug('[find] no pages for uid', article.uid)
          return article
        }
        // add pages
        if (addonsIndex[article.uid].pages) {
          // NOTE [RK]: Checking type of object is a quick fix around cached
          // sequelized results. When a result is a plain Object instance it means
          // it came from cache. Otherwise it is a model instance and it was
          // loaded from the database.
          // This should be moved to the SequelizeService layer.
          article.pages = addonsIndex[article.uid].pages.map((d: any) => (d.constructor === Object ? d : d.toJSON()))
        }
        if (pageUids.length === 1) {
          article.regions = article?.regions?.filter(r => pageUids.indexOf(r.pageUid) !== -1)
        }
        article.assignIIIF()
        return article
      }),
    }))
  }

  async get(id: string, params: any) {
    const uids = id.split(',')
    if (uids.length > 1 || params.findAll) {
      debug(
        `[get] with ${uids.length} ids -> redirect to 'find', user:`,
        params.user ? params.user.uid : 'no user found'
      )

      return this._find({
        ...params,
        findAll: true,
        query: {
          limit: 20,
          filters: [
            {
              type: 'uid',
              q: uids,
            },
          ],
        },
      }).then(res => res.data)
    }
    if (uids.length > 20) {
      return []
    }

    debug(`[get:${id}] with auth params:`, params.user ? params.user.uid : 'no user found')
    const fl = Article.ARTICLE_SOLR_FL_LIST_ITEM.concat([
      'lb_plain:[json]',
      'rb_plain:[json]',
      'pp_plain:[json]',
      'nem_offset_plain:[json]',
      // [RK] Note: The content fields below are missing in
      // `ARTICLE_SOLR_FL_LIST_ITEM`. They may not be needed in 'find' endpoint
      // but are certainly needed here.
      'content_txt_fr',
      'content_txt_en',
      'content_txt_de',
    ])

    return Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      measureTime(
        () =>
          this.SolrService.get(id, {
            fl,
          }),
        'articles.get.solr.articles'
      ),

      // get the newspaper and the version,
      measureTime(
        () =>
          this.SequelizeService.get(id, {
            scope: 'get',
            where: {
              uid: id,
            },
          }).catch(() => {
            debug(`[get:${id}]: SequelizeService warning, no data found for ${id} ...`)
          }),
        'articles.get.db.articles'
      ),
      measureTime(
        () =>
          Issue.sequelize(this.app!.get('sequelizeClient')).findOne({
            attributes: ['accessRights'],
            where: {
              uid: id.split(/-i\d{4}/).shift(),
            },
          }),
        'articles.get.db.issue'
      ),
    ])
      .then(([article, addons, issue]) => {
        if (addons) {
          if (issue) {
            article.issue.accessRights = (issue as any).accessRights
          }
          article.pages = addons.pages.map((d: any) => d.toJSON())
          article.v = addons.v
        }
        article.assignIIIF()
        return article
      })
      .catch(err => {
        console.error(err)
        throw new NotFound()
      })
  }
}

export default function (options: ServiceOptions) {
  return new Service(options)
}
