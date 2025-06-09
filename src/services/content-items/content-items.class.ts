import { keyBy } from 'lodash'
import Debug from 'debug'
import { Op } from 'sequelize'

import { logger } from '../../logger'
import initSequelizeService, { Service as SequelizeService } from '../sequelize.service'
import Article from '../../models/articles.model'
import Issue from '../../models/issues.model'
import { measureTime } from '../../util/instruments'
import { ImpressoApplication } from '../../types'
import { SlimUser } from '../../authentication'
import { asFind, asGet, SolrFactory } from '../../util/solr/adapters'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import { withRewrittenIIIF } from '../../models/pages.model'
import { buildResolvers } from '../../internalServices/cachedResolvers'
import {
  AricleContentItemOffsetsAndBoundariesFields,
  ArticleContentItemMetadataFields,
  ArticleCoordinatesFields,
  ContentFields,
  CoreIdentifierFields,
  ExcerptFields,
  MetaFields,
  NamedEntitiesFields,
  RadioBroadcastContentItemMetadataFields,
  RadioBroadcastTimecodeFields,
  RightsFields,
  TitleFields,
} from '../../models/content-item.model'
import { plainFieldAsJson } from '../../util/solr'

/**
 * Fields needed to fetch a list of content items.
 * Some things are excluded here, like full content, etc.
 */
export const FindMethodFields = [
  // common fields
  ...CoreIdentifierFields,
  ...MetaFields,
  ...RightsFields,
  ...TitleFields,
  ...ExcerptFields,
  ...NamedEntitiesFields,
  // article specific
  ...ArticleCoordinatesFields,
  ...ArticleContentItemMetadataFields,
  // radio specific
  ...RadioBroadcastContentItemMetadataFields,
]

/**
 * Fields needed to fetch a single content item.
 * Same as above but with extra data:
 *  - content
 *  - content breaks (for articles)
 */
const GetMethodFields = [
  ...FindMethodFields,
  ...ContentFields,
  // article json fields
  ...AricleContentItemOffsetsAndBoundariesFields.map(plainFieldAsJson),
  // radio json fields
  ...RadioBroadcastTimecodeFields.map(plainFieldAsJson),
]

const debug = Debug('impresso/services:content-items')

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
  app: ImpressoApplication
}

interface FindOptions {
  query: {
    filters?: any[]

    // things needed by SolService.find
    sq?: string
    sfq?: string
    limit?: number
    offset?: number
    facets?: Record<string, any>
    order_by?: string
    highlight_by?: string
    collapse_by?: string
    collapse_fn?: string
    requestOriginalPath?: boolean
  }
  user: SlimUser

  // things needed by SolService.find
  fl?: string[]
}

export class ContentItemService {
  app: ImpressoApplication
  SequelizeService: SequelizeService
  solrFactory: SolrFactory<any, any, any, Article>

  constructor({ app }: ServiceOptions) {
    this.app = app
    this.SequelizeService = initSequelizeService({
      app,
      name: 'articles',
      cacheReads: true,
    })
    this.solrFactory = Article.solrFactory as SolrFactory<any, any, any, Article>
  }

  get solr(): SimpleSolrClient {
    return this.app?.service('simpleSolrClient')!
  }

  async find(params: any) {
    return await this._find(params)
  }

  async findInternal(params: FindOptions) {
    return await this._find(params)
  }

  async _find(params: FindOptions) {
    const fl = FindMethodFields
    const pageUids = (params.query.filters || []).filter(d => d.type === 'page').map(d => d.q)

    debug('[find] use auth user:', params.user ? params.user.uid : 'no user')
    // if(params.isSafe query.filters)

    const results = await asFind<any, any, any, Article>(this.solr, 'search', { ...params, fl }, this.solrFactory)

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
            uid: { [Op.in]: results.data.map(d => d.uid) },
          },
          limit: results.data.length,
          order_by: [['uid', 'DESC']],
        })
          .catch(err => {
            logger.error(err)
            return { data: [] }
          })
          .then(({ data }) => keyBy(data, 'uid')),
      'articles.find.db.articles'
    )

    // get accessRights from issues table
    const issuesRequest = {
      attributes: ['accessRights', 'uid'],
      where: {
        uid: { [Op.in]: results.data.map(d => d?.issue?.uid) },
      },
    }
    const getRelatedIssuesPromise = measureTime(() => getIssues(issuesRequest, this.app!), 'articles.find.db.issues')

    // do the loop
    const result = await Promise.all([getAddonsPromise, getRelatedIssuesPromise]).then(
      ([addonsIndex, issuesIndex]) => ({
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
            const rewriteRules = this.app?.get('images')?.rewriteRules ?? []
            article.pages = addonsIndex[article.uid].pages.map((d: any) =>
              withRewrittenIIIF(d.constructor === Object ? d : d.toJSON(), rewriteRules)
            )
          }
          if (pageUids.length === 1) {
            article.regions = article?.regions?.filter((r: { pageUid: string }) => pageUids.indexOf(r.pageUid) !== -1)
          }
          return Article.assignIIIF(article)
        }),
      })
    )

    const resolvers = buildResolvers(this.app!)
    result.data = await Promise.all(
      result.data.map(async (item: Article) => {
        item.locations = await Promise.all(item.locations?.map(item => resolvers.location(item.uid)) ?? [])
        item.persons = await Promise.all(item.persons?.map(item => resolvers.person(item.uid)) ?? [])
        return item
      })
    )

    return results
  }

  async get(id: string, params: any) {
    debug(`[get:${id}] with auth params:`, params.user ? params.user.uid : 'no user found')
    const fl = GetMethodFields

    return Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      asGet(this.solr, 'search', id, { fl }, this.solrFactory),

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
      .then(async ([article, addons, issue]) => {
        if (addons && article) {
          if (issue && article.issue) {
            article.issue.accessRights = (issue as any).accessRights
          }
          article.pages = addons.pages.map((d: any) => withRewrittenIIIF(d.toJSON()))
        }

        if (article != null) {
          const resolvers = buildResolvers(this.app!)

          article.locations = await Promise.all(article.locations?.map(item => resolvers.location(item.uid)) ?? [])
          article.persons = await Promise.all(article.persons?.map(item => resolvers.person(item.uid)) ?? [])

          return Article.assignIIIF(article)
        }

        return
      })
      .catch(err => {
        logger.error(err)
        throw err
      })
  }
}

export default function (options: ServiceOptions) {
  return new ContentItemService(options)
}
