import { Dictionary, keyBy, take } from 'lodash'
import Debug from 'debug'
import { Op } from 'sequelize'

import { logger } from '../../logger'
import initSequelizeService, { Service as SequelizeService } from '../sequelize.service'
import Article, { IFragmentsAndHighlights } from '../../models/articles.model'
import Issue from '../../models/issues.model'
import { measureTime } from '../../util/instruments'
import { ImpressoApplication } from '../../types'
import { SlimUser } from '../../authentication'
import { asFind, asGet, findAllRequestAdapter, findRequestAdapter, SolrFactory } from '../../util/solr/adapters'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import Page, { withRewrittenIIIF } from '../../models/pages.model'
import { buildResolvers } from '../../internalServices/cachedResolvers'
import {
  SlimContentItemFieldsNames,
  FullContentItemFieldsNames,
  SlimDocumentFields,
  toContentItem,
  FullContentOnlyFieldsType,
  AllDocumentFields,
  IFullContentItemFieldsNames,
  withMatches,
} from '../../models/content-item'
import { ClientService } from '@feathersjs/feathers'
import { FindResponse } from '../../models/common'
import { ContentItem, ContentItemPage } from '../../models/generated/schemas/contentItem'
import { ContentItemDbModel } from '../../models/content-item.model'
import DBContentItemPage, { getIIIFManifestUrl, getIIIFThumbnailUrl } from '../../models/content-item-page.model'
import { mapRecordValues } from '../../util/fn'
import { NotFound } from '@feathersjs/errors'
import { BaseUser, Collection, Topic } from '../../models/generated/schemas'
import { WellKnownKeys } from '../../cache'
import { getContentItemMatches } from '../search/search.extractors'
import { AudioFields, ImageFields, SemanticEnrichmentsFields } from '../../models/generated/solr/contentItem'
import { allContentFields, plainFieldAsJson } from '../../util/solr'

const DefaultLimit = 10

/**
 * The fields below must be expanded to object from JSON.
 */
type ExpansionFields =
  | keyof Pick<ImageFields, 'pp_plain' | 'lb_plain' | 'pb_plain' | 'rb_plain'>
  | keyof Pick<AudioFields, 'rreb_plain'>
  | keyof Pick<SemanticEnrichmentsFields, 'nem_offset_plain' | 'nag_offset_plain'>
const JSONExpansionFields = [
  'pp_plain',
  'lb_plain',
  'pb_plain',
  'rb_plain',
  'rreb_plain',
  'rrreb_plain' as ExpansionFields, // TODO: Remove the `rrreb_plain` option when the index is fixed. It's a mistake.
  'nag_offset_plain',
  'nem_offset_plain',
] satisfies ExpansionFields[]

const isExpansionField = (field: IFullContentItemFieldsNames): field is ExpansionFields => {
  return JSONExpansionFields.includes(field as any as ExpansionFields)
}

const withJsonExpansion = (field: IFullContentItemFieldsNames) => {
  return isExpansionField(field) ? plainFieldAsJson(field) : field
}

/**
 * Fields needed to fetch a list of content items.
 * Some things are excluded here, like full content, etc.
 */
export const FindMethodFields = [...SlimContentItemFieldsNames].map(withJsonExpansion)

/**
 * Fields needed to fetch a single content item.
 * All fields are included here.
 */
const GetMethodFields = [...FullContentItemFieldsNames].map(withJsonExpansion)

// async function getIssues(request: Record<string, any>, app: ImpressoApplication) {
//   const sequelize = app.get('sequelizeClient')
//   const cacheManager = app.get('cacheManager')
//   const cacheKey = initSequelizeService.getCacheKeyForReadSqlRequest(request, 'issues')

//   return cacheManager
//     .wrap(cacheKey, async () =>
//       Issue.sequelize(sequelize!)
//         .findAll(request)
//         .then((rows: any[]) => rows.map(d => d.get()))
//     )
//     .then(rows => keyBy(rows, 'uid'))
// }

interface ServiceOptions {
  app: ImpressoApplication
}

export interface FindOptions {
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
  user?: SlimUser

  // things needed by SolService.find
  fl?: string[]
}

const pageWithIIIF = (page: ContentItemPage, dbPage: DBContentItemPage, app: ImpressoApplication): ContentItemPage => {
  return {
    ...page,
    iiif: {
      manifestUrl: getIIIFManifestUrl(dbPage, app),
      thumnbnailUrl: getIIIFThumbnailUrl(dbPage, app),
    },
  }
}

const withIIIF = (
  contentItems: ContentItem[],
  dbPagesLookup: Dictionary<Dictionary<DBContentItemPage>>,
  app: ImpressoApplication
) => {
  return contentItems.map(item => {
    const pages = item.image?.pages ?? []
    const enrichedPages = pages.map(page => {
      const dbPage = dbPagesLookup[item.id]?.[page.id!]
      if (dbPage) return pageWithIIIF(page, dbPage, app)
      return page
    })
    if (enrichedPages.length > 0) {
      return {
        ...item,
        image: {
          ...item.image,
          pages: enrichedPages,
        },
      }
    }
    return item
  })
}

const withTopics = (contentItems: ContentItem[], topicsLookup: Dictionary<Topic>): ContentItem[] => {
  return contentItems.map(item => {
    const topics = item.semanticEnrichments?.topics ?? []
    const enrichedTopics = topics.map(topic => {
      const topicDetails = topicsLookup[topic.id]
      if (topicDetails) {
        return {
          ...topic,
          language: topicDetails.language,
          label: take(topicDetails.words, 5)
            .map(word => word.w)
            .join(' · '),
        }
      }
      return topic
    })

    if (enrichedTopics.length > 0) {
      return {
        ...item,
        semanticEnrichments: {
          ...item.semanticEnrichments,
          topics: enrichedTopics,
        },
      }
    }
    return item
  })
}

const withCollections = (contentItems: ContentItem[], collectionsLookup: Dictionary<Collection[]>): ContentItem[] => {
  if (Object.keys(collectionsLookup).length === 0) return contentItems

  return contentItems.map(item => {
    const collections = collectionsLookup[item.id] ?? []
    if (collections.length > 0) {
      return {
        ...item,
        collections,
      }
    }
    return item
  })
}

export const toContentItemWithMatches = (fragmentsAndHighlights: IFragmentsAndHighlights) => {
  return (doc: AllDocumentFields): ContentItem => {
    const contentItem = toContentItem(doc)
    const matches = getContentItemMatches(contentItem, doc.pp_plain, fragmentsAndHighlights)

    return {
      ...contentItem,
      text: {
        ...contentItem.text,
        matches: matches,
      },
    }
  }
}

export class ContentItemService
  implements Pick<ClientService<ContentItem, unknown, unknown, FindResponse<ContentItem>>, 'find' | 'get'>
{
  app: ImpressoApplication
  contentItemsDbService: SequelizeService
  _topicsCache: Topic[] | undefined = undefined

  constructor({ app }: ServiceOptions) {
    this.app = app
    this.contentItemsDbService = initSequelizeService({
      app,
      name: 'content-item',
      cacheReads: true,
    })
  }

  async getTopics(topicIds: string[]): Promise<Dictionary<Topic>> {
    if (this._topicsCache === undefined) {
      const result = await this.app.get('cacheManager').get<string>(WellKnownKeys.Topics)
      this._topicsCache = JSON.parse(result ?? '[]')
    }
    const topics = this._topicsCache?.filter(t => topicIds.includes(t.uid)) ?? []
    return keyBy(topics, 'uid')
  }

  async getCollections(contentItemIds: string[], user?: SlimUser): Promise<Dictionary<Collection[]>> {
    if (contentItemIds.length === 0 || !user) return {}

    const collectables = await this.app.service('collectable-items').find({
      authenticated: true,
      user,
      query: {
        resolve: 'collection',
        item_uids: contentItemIds,
      },
    })

    const collectablesIndex = keyBy(collectables.data, 'itemId')

    return mapRecordValues(collectablesIndex, (group, _) => group.collections ?? [])
  }

  get solr(): SimpleSolrClient {
    return this.app?.service('simpleSolrClient')!
  }

  async find(params: FindOptions): Promise<FindResponse<ContentItem>> {
    return await this._find(params)
  }

  async findInternal(params: FindOptions): Promise<FindResponse<ContentItem>> {
    return await this._find(params)
  }

  async _findPages(contentItemIds: string[]): Promise<Dictionary<Dictionary<DBContentItemPage>>> {
    if (contentItemIds.length === 0) {
      return {}
    }
    const pagesByContentItemId: Record<string, { pages: DBContentItemPage[] }> = await this.contentItemsDbService
      .find({
        include: 'pages',
        where: {
          uid: { [Op.in]: contentItemIds },
        },
        limit: contentItemIds.length,
        offset: 0,
        order_by: [['uid', 'DESC']],
      })
      .then(({ data }) => keyBy(data, 'uid'))

    const pagesByIds = mapRecordValues(pagesByContentItemId, ({ pages }, ciId) => {
      return keyBy(pages, 'uid')
    })

    return pagesByIds
  }

  async _find(params: FindOptions): Promise<FindResponse<ContentItem>> {
    const fields = FindMethodFields

    const request = findRequestAdapter(params)
    const requestBody = {
      ...request,
      fields: fields.join(','),
      params: {
        ...request.params,
        highlight_by: allContentFields.join(','),
        highlightProps: {
          'hl.snippets': 10,
          'hl.fragsize': 100,
        },
        // add variables if there are any
        ...((params.query as any)?.['sv'] ?? {}),
      },
    }
    const results = await this.solr.select<SlimDocumentFields>(this.solr.namespaces.Search, {
      body: requestBody,
    })

    const contentItems = (results.response?.docs?.map(toContentItem) ?? []).map(item => withMatches(item, results))

    // get data enrichment items
    const topicIds = contentItems.flatMap(d => d.semanticEnrichments?.topics?.map(t => t.id) ?? [])
    const contentItemIds = contentItems.map(d => d.id)

    const [topicsLookup, dbPages, collectionsLookup] = await Promise.all([
      this.getTopics(topicIds),
      this._findPages(contentItemIds),
      this.getCollections(contentItemIds, params.user),
    ])

    // add IIIF URLs to the content items pages
    const enrichedContentItems = withCollections(
      withTopics(withIIIF(contentItems, dbPages, this.app), topicsLookup),
      collectionsLookup
    )

    return {
      data: enrichedContentItems,
      offset: results.response?.start ?? 0,
      limit: request.limit ?? DefaultLimit,
      total: results.response?.numFound ?? 0,
    }

    // if (results.response?.docs?.length)

    // const results = await asFind<any, any, any, Article>(this.solr, 'search', { ...params, fl }, this.solrFactory)

    // go out if there's nothing to do.
    // if (results.total === 0) {
    //   return results
    // }

    // add newspapers and other things from this class sequelize method
    // const getAddonsPromise = measureTime(
    //   () =>
    //     this.SequelizeService.find({
    //       ...params,
    //       scope: 'get',
    //       where: {
    //         uid: { [Op.in]: results.data.map(d => d.uid) },
    //       },
    //       limit: results.data.length,
    //       order_by: [['uid', 'DESC']],
    //     })
    //       .catch(err => {
    //         logger.error(err)
    //         return { data: [] }
    //       })
    //       .then(({ data }) => keyBy(data, 'uid')),
    //   'articles.find.db.articles'
    // )

    // get accessRights from issues table
    // const issuesRequest = {
    //   attributes: ['accessRights', 'uid'],
    //   where: {
    //     uid: { [Op.in]: results.data.map(d => d?.issue?.uid) },
    //   },
    // }
    // const getRelatedIssuesPromise = measureTime(() => getIssues(issuesRequest, this.app!), 'articles.find.db.issues')

    // do the loop
    // const result = await Promise.all([getAddonsPromise, getRelatedIssuesPromise]).then(
    //   ([addonsIndex, issuesIndex]) => ({
    //     ...results,
    //     data: results.data.map((article: Article) => {
    //       if (article?.issue?.uid != null && issuesIndex[article?.issue?.uid]) {
    //         article.issue.accessRights = issuesIndex[article.issue.uid].accessRights
    //       }
    //       if (!addonsIndex[article.uid]) {
    //         debug('[find] no pages for uid', article.uid)
    //         return article
    //       }
    //       // add pages
    //       if (addonsIndex[article.uid].pages) {
    //         // NOTE [RK]: Checking type of object is a quick fix around cached
    //         // sequelized results. When a result is a plain Object instance it means
    //         // it came from cache. Otherwise it is a model instance and it was
    //         // loaded from the database.
    //         // This should be moved to the SequelizeService layer.
    //         const rewriteRules = this.app?.get('images')?.rewriteRules ?? []
    //         article.pages = addonsIndex[article.uid].pages.map((d: any) =>
    //           withRewrittenIIIF(d.constructor === Object ? d : d.toJSON(), rewriteRules)
    //         )
    //       }
    //       if (pageUids.length === 1) {
    //         article.regions = article?.regions?.filter((r: { pageUid: string }) => pageUids.indexOf(r.pageUid) !== -1)
    //       }
    //       return Article.assignIIIF(article)
    //     }),
    //   })
    // )

    // const resolvers = buildResolvers(this.app!)
    // result.data = await Promise.all(
    //   result.data.map(async (item: Article) => {
    //     item.locations = await Promise.all(item.locations?.map(item => resolvers.location(item.uid)) ?? [])
    //     item.persons = await Promise.all(item.persons?.map(item => resolvers.person(item.uid)) ?? [])
    //     return item
    //   })
    // )

    // return results
  }

  async get(id: string, params: any): Promise<ContentItem> {
    // debug(`[get:${id}] with auth params:`, params.user ? params.user.uid : 'no user found')

    const request = findAllRequestAdapter({
      q: `id:${id}`,
      limit: 1,
      offset: 0,
      fl: GetMethodFields,
    })

    const solrRequest = this.solr.select<SlimDocumentFields>(this.solr.namespaces.Search, {
      body: request,
    })
    const dbPagesRequest = this._findPages([id])
    const collectionsRequest = this.getCollections([id], params.user)

    const [result, dbPagesLookup, collectionsLookup] = await Promise.all([
      solrRequest,
      dbPagesRequest,
      collectionsRequest,
    ])

    const contentItem = (result.response?.docs?.map(
      toContentItemWithMatches(result.response as IFragmentsAndHighlights)
    ) ?? [])?.[0]

    if (!contentItem) throw new NotFound(`Content item with id ${id} not found`)

    const topicIds = contentItem.semanticEnrichments?.topics?.map(t => t.id) ?? []
    const topicsLookup = await this.getTopics(topicIds)

    const enrichedContentItem = withCollections(
      withTopics(withIIIF([contentItem], dbPagesLookup, this.app), topicsLookup),
      collectionsLookup
    )?.[0]

    return enrichedContentItem

    //   return Promise.all([
    //     // we perform a solr request to get
    //     // the full text, regions of the specified article
    //     asGet(this.solr, 'search', id, { fl }, this.solrFactory),

    //     // get the newspaper and the version,
    //     measureTime(
    //       () =>
    //         this.SequelizeService.get(id, {
    //           scope: 'get',
    //           where: {
    //             uid: id,
    //           },
    //         }).catch(() => {
    //           debug(`[get:${id}]: SequelizeService warning, no data found for ${id} ...`)
    //         }),
    //       'articles.get.db.articles'
    //     ),
    //     measureTime(
    //       () =>
    //         Issue.sequelize(this.app!.get('sequelizeClient')!).findOne({
    //           attributes: ['accessRights'],
    //           where: {
    //             uid: id.split(/-i\d{4}/).shift(),
    //           },
    //         }),
    //       'articles.get.db.issue'
    //     ),
    //   ])
    //     .then(async ([article, addons, issue]) => {
    //       if (addons && article) {
    //         if (issue && article.issue) {
    //           article.issue.accessRights = (issue as any).accessRights
    //         }
    //         article.pages = addons.pages.map((d: any) => withRewrittenIIIF(d.toJSON()))
    //       }

    //       if (article != null) {
    //         const resolvers = buildResolvers(this.app!)

    //         article.locations = await Promise.all(article.locations?.map(item => resolvers.location(item.uid)) ?? [])
    //         article.persons = await Promise.all(article.persons?.map(item => resolvers.person(item.uid)) ?? [])

    //         return Article.assignIIIF(article)
    //       }

    //       return
    //     })
    //     .catch(err => {
    //       logger.error(err)
    //       throw err
    //     })
    // }
  }
}

export default function (options: ServiceOptions) {
  return new ContentItemService(options)
}
