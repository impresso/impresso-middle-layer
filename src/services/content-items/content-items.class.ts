import { keyBy, take } from 'lodash-es'
import Debug from 'debug'
import { Op } from 'sequelize'

import { logger } from '@/logger.js'
import initSequelizeService, { Service as SequelizeService } from '@/services/sequelize.service.js'
import Article, { IFragmentsAndHighlights } from '@/models/articles.model.js'
import Issue from '@/models/issues.model.js'
import { measureTime } from '@/util/instruments.js'
import { ImpressoApplication } from '@/types.js'
import { SlimUser } from '@/authentication.js'
import { asFind, asGet, findAllRequestAdapter, findRequestAdapter, SolrFactory } from '@/util/solr/adapters.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import Page, { withRewrittenIIIF } from '@/models/pages.model.js'
import { ICachedResolvers, buildResolvers } from '@/internalServices/cachedResolvers.js'
import {
  SlimContentItemFieldsNames,
  FullContentItemFieldsNames,
  SlimDocumentFields,
  toContentItem,
  FullContentOnlyFieldsType,
  AllDocumentFields,
  IFullContentItemFieldsNames,
  withMatches,
  EmbeddingsFields,
  ContentTextFields,
} from '@/models/content-item.js'
import { ClientService, Params } from '@feathersjs/feathers'
import { FindResponse } from '@/models/common.js'

export interface FindResponseWithCursor<T> extends FindResponse<T> {
  nextCursorMark?: string
}

import {
  ContentItem,
  ContentItemPage,
  Collection as ContentItemCollection,
} from '@/models/generated/canonical/contentItem.js'
import { ContentItemDbModel } from '@/models/content-item.model.js'
import DBContentItemPage, { getIIIFManifestUrl, getIIIFThumbnailUrl } from '@/models/content-item-page.model.js'
import { mapRecordValues } from '@/util/fn.js'
import { NotFound } from '@feathersjs/errors'
import { Collection } from '@/models/generated/canonical.js'
import { getContentItemMatches } from '@/services/search/search.extractors.js'
import { AudioFields, ImageFields, SemanticEnrichmentsFields } from '@/models/generated/external/solr/ContentItem.js'
import { allContentFields, ensureIdSort, getSortParams, plainFieldAsJson, ScoreField } from '@/util/solr/index.js'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '@/models/authorization.js'
import { base64BytesToBigInt } from '@/util/bigint.js'
import { QueueService } from '@/internalServices/queue.js'
import { Filter } from 'impresso-jscommons'
import { isTrue } from '@/util/queryParameters.js'

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
 * Fields needed to fetch a list of content items including embeddings.
 */
const FindMethodFieldsWithEmbeddings = [...SlimContentItemFieldsNames, ...EmbeddingsFields].map(withJsonExpansion)

/**
 * Fields needed to fetch a single content item.
 * All fields are included here.
 */
const GetMethodFields = [...FullContentItemFieldsNames.filter(f => !EmbeddingsFields.includes(f as any))].map(
  withJsonExpansion
)
const GetMethodFieldsWithEmbeddings = [...FullContentItemFieldsNames].map(withJsonExpansion)

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

/**
 * Attach authorization bitmaps to the symbol key where
 * all code that works with content items in the hooks
 * can find it.
 */
const withAuthorizationBitmaps = (item: ContentItem): ContentItem => {
  return {
    ...item,
    [AuthorizationBitmapsKey]: {
      explore:
        item.access?.accessBitmaps?.explore != null
          ? base64BytesToBigInt(item.access?.accessBitmaps?.explore)
          : undefined,
      getTranscript:
        item.access?.accessBitmaps?.getTranscript != null
          ? base64BytesToBigInt(item.access?.accessBitmaps?.getTranscript)
          : undefined,
      getImages:
        item.access?.accessBitmaps?.getImages != null
          ? base64BytesToBigInt(item.access?.accessBitmaps?.getImages)
          : undefined,
      getAudio:
        item.access?.accessBitmaps?.getAudio != null
          ? base64BytesToBigInt(item.access?.accessBitmaps?.getAudio)
          : undefined,
    } satisfies AuthorizationBitmapsDTO,
  }
}

interface ServiceOptions {
  app: ImpressoApplication
}

interface FindQuery {
  filters?: Filter[]

  // things needed by SolService.find
  sq?: string
  sfq?: string | string[]
  limit?: number
  offset?: number
  facets?: Record<string, any>
  order_by?: string
  highlight_by?: string
  collapse_by?: string
  collapse_fn?: string
  requestOriginalPath?: boolean
  include_embeddings?: boolean
  include_transcript?: boolean
  term?: string
  nextCursorMark?: string
}

interface AsPublicApiMixin {
  asPublicApi?: boolean
}

interface FindFlExtra {
  // things needed by SolService.find
  fl?: string[]
}

interface WithUser {
  user?: SlimUser
}

interface GetQueryParams {
  include_embeddings?: boolean
}
export type GetParams = Params<GetQueryParams> & WithUser & AsPublicApiMixin
export type FindParams = Params<FindQuery> & WithUser & FindFlExtra & AsPublicApiMixin

const pageWithIIIF = (page: ContentItemPage, dbPage: DBContentItemPage, app: ImpressoApplication): ContentItemPage => {
  return {
    ...page,
    iiif: {
      manifestUrl: getIIIFManifestUrl(dbPage, app),
      thumbnailUrl: getIIIFThumbnailUrl(dbPage, app),
    },
  }
}

type Dictionary<T> = Record<string, T>

type ContentItemEnricher = (item: ContentItem) => ContentItem | Promise<ContentItem>

const enrichContentItems = async (
  contentItems: ContentItem[],
  enrichers: ContentItemEnricher[]
): Promise<ContentItem[]> => {
  if (contentItems.length === 0 || enrichers.length === 0) return contentItems

  return await Promise.all(
    contentItems.map(async item => {
      let enrichedItem = item
      for (const withEnricher of enrichers) {
        enrichedItem = await withEnricher(enrichedItem)
      }
      return enrichedItem
    })
  )
}

const withIIIF =
  (dbPagesLookup: Dictionary<Dictionary<DBContentItemPage>>, app: ImpressoApplication): ContentItemEnricher =>
  item => {
    const pages = item.image?.pages ?? []
    if (pages.length === 0) return item

    const enrichedPages = pages.map(page => {
      const dbPage = dbPagesLookup[item.id]?.[page.id!]
      if (dbPage) return pageWithIIIF(page, dbPage, app)
      return page
    })

    return {
      ...item,
      image: {
        ...item.image,
        pages: enrichedPages,
      },
    }
  }

const withTopics =
  (topicResolver: ICachedResolvers['topic']): ContentItemEnricher =>
  async item => {
    const topics = item.semanticEnrichments?.topics ?? []
    if (topics.length === 0) return item

    let hasTopicPatch = false

    const enrichedTopics = await Promise.all(
      topics.map(async topic => {
        if (topic.label != null && topic.languageCode != null) return topic

        const topicDetails = await topicResolver(topic.id)
        if (topicDetails == null) return topic

        const topicLabel =
          topic.label ??
          take(topicDetails.words, 5)
            .map(word => word.w)
            .join(' · ')

        const languageCode = topic.languageCode ?? topicDetails.language
        const hasPatch =
          (topic.label == null && topicLabel !== '') || (topic.languageCode == null && languageCode != null)

        if (!hasPatch) return topic
        hasTopicPatch = true
        return {
          ...topic,
          ...(topic.label == null && topicLabel !== '' ? { label: topicLabel } : {}),
          ...(topic.languageCode == null && languageCode != null ? { languageCode } : {}),
        }
      })
    )

    if (!hasTopicPatch) {
      return item
    }

    return {
      ...item,
      semanticEnrichments: {
        ...item.semanticEnrichments,
        topics: enrichedTopics,
      },
    }
  }

const withCollections =
  (collectionsLookup: Dictionary<Collection[]>): ContentItemEnricher =>
  item => {
    const collections = collectionsLookup[item.id] ?? []
    if (collections.length === 0) return item

    return {
      ...item,
      semanticEnrichments: {
        ...item.semanticEnrichments,
        collections,
      },
    }
  }

interface ContentItemMetadataResolvers {
  mediaSource: ICachedResolvers['mediaSource']
  partner: ICachedResolvers['partner']
  dataDomain: ICachedResolvers['dataDomain']
  copyright: ICachedResolvers['copyright']
  contentItemType: ICachedResolvers['contentItemType']
}

const withMetaLabels =
  ({ mediaSource, partner }: ContentItemMetadataResolvers): ContentItemEnricher =>
  async item => {
    const [mediaSourceItem, partnerItem] = await Promise.all([
      item.meta?.mediaTitle == null && item.meta?.mediaId != null ? mediaSource(item.meta.mediaId) : undefined,
      item.meta?.partnerTitle == null && item.meta?.partnerId != null ? partner(item.meta.partnerId) : undefined,
    ])
    const mediaTitle = mediaSourceItem?.name
    const partnerTitle = partnerItem?.title
    const hasMetaPatch =
      (mediaTitle != null && item.meta?.mediaTitle == null) || (partnerTitle != null && item.meta?.partnerTitle == null)
    if (!hasMetaPatch || item.meta == null) return item

    return {
      ...item,
      meta: {
        ...item.meta,
        ...(mediaTitle != null && item.meta.mediaTitle == null ? { mediaTitle } : {}),
        ...(partnerTitle != null && item.meta.partnerTitle == null ? { partnerTitle } : {}),
      },
    }
  }

const withAccessLabels =
  ({ dataDomain, copyright }: ContentItemMetadataResolvers): ContentItemEnricher =>
  async item => {
    const [dataDomainItem, copyrightItem] = await Promise.all([
      item.access?.dataDomainLabel == null && item.access?.dataDomain != null
        ? dataDomain(item.access.dataDomain)
        : undefined,
      item.access?.copyrightLabel == null && item.access?.copyright != null
        ? copyright(item.access.copyright)
        : undefined,
    ])
    const dataDomainLabel = dataDomainItem?.label
    const copyrightLabel = copyrightItem?.label
    const hasAccessPatch =
      (dataDomainLabel != null && item.access?.dataDomainLabel == null) ||
      (copyrightLabel != null && item.access?.copyrightLabel == null)
    if (!hasAccessPatch || item.access == null) return item

    return {
      ...item,
      access: {
        ...item.access,
        ...(dataDomainLabel != null && item.access.dataDomainLabel == null ? { dataDomainLabel } : {}),
        ...(copyrightLabel != null && item.access.copyrightLabel == null ? { copyrightLabel } : {}),
      },
    }
  }

const withTextLabels =
  ({ contentItemType }: ContentItemMetadataResolvers): ContentItemEnricher =>
  async item => {
    const [itemTypeItem] = await Promise.all([
      item.text?.itemTypeLabel == null && item.text?.itemType != null ? contentItemType(item.text.itemType) : undefined,
    ])
    const itemTypeLabel = itemTypeItem?.label
    const hasTextPatch = itemTypeLabel != null && item.text?.itemTypeLabel == null
    if (!hasTextPatch || item.text == null) return item

    return {
      ...item,
      text: {
        ...item.text,
        ...(itemTypeLabel != null && item.text.itemTypeLabel == null ? { itemTypeLabel } : {}),
      },
    }
  }

export const toContentItemWithMatches = (fragmentsAndHighlights: IFragmentsAndHighlights, maxScore?: number) => {
  return (doc: AllDocumentFields): ContentItem => {
    const contentItem = toContentItem(doc, { maxScore })
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

export type IContentItemService = Pick<
  ClientService<ContentItem, unknown, unknown, FindResponse<ContentItem>>,
  'find' | 'get'
>

export class ContentItemService implements IContentItemService {
  app: ImpressoApplication
  contentItemsDbService: SequelizeService
  _cachedResolvers: ICachedResolvers | undefined = undefined

  constructor({ app }: ServiceOptions) {
    this.app = app
    this.contentItemsDbService = initSequelizeService({
      app,
      name: 'content-item',
      cacheReads: true,
    })
  }

  async getCollections(contentItemIds: string[], user?: SlimUser): Promise<Dictionary<Collection[]>> {
    if (contentItemIds.length === 0 || !user) return {}

    return await this.app.service('collections').findByContentItems(contentItemIds, true, user)
  }

  getCachedResolvers(): ICachedResolvers {
    if (this._cachedResolvers === undefined) {
      this._cachedResolvers = buildResolvers(this.app)
    }
    return this._cachedResolvers
  }

  getContentItemMetadataResolvers(): ContentItemMetadataResolvers {
    const resolvers = this.getCachedResolvers()
    return {
      mediaSource: resolvers.mediaSource,
      partner: resolvers.partner,
      dataDomain: resolvers.dataDomain,
      copyright: resolvers.copyright,
      contentItemType: resolvers.contentItemType,
    }
  }

  get solr(): SimpleSolrClient {
    return this.app?.service('simpleSolrClient')!
  }

  async find(params: FindParams): Promise<FindResponseWithCursor<ContentItem>> {
    return await this._find(params)
  }

  async findInternal(params: FindParams): Promise<FindResponseWithCursor<ContentItem>> {
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
          id: { [Op.in]: contentItemIds },
        },
        limit: contentItemIds.length,
        offset: 0,
        order_by: [['id', 'DESC']],
      })
      .then(({ data }) => keyBy(data, 'id'))

    const pagesByIds = mapRecordValues(pagesByContentItemId, ({ pages }, ciId) => {
      return keyBy(pages, 'id')
    })

    return pagesByIds
  }

  async _find(params: FindParams): Promise<FindResponseWithCursor<ContentItem>> {
    const fields = [
      ...[ScoreField],
      // if include embeddings is requested, add those fields
      ...(isTrue(params.query?.include_embeddings) ? FindMethodFieldsWithEmbeddings : FindMethodFields),
      // if include transcript is requested, add those fields
      ...(isTrue(params.query?.include_transcript) ? ContentTextFields : []),
    ]

    // With embeddings search we cannot do highlighting: Solr returns an error.
    const hasEmbeddingFilter = params?.query?.filters?.find(f => f.type === 'embedding') != null
    const highlightBLock = hasEmbeddingFilter
      ? { hl: false }
      : {
          highlight_by: allContentFields.join(','),
          highlightProps: {
            'hl.snippets': 10,
            'hl.fragsize': 100,
          },
        }

    const request = findRequestAdapter(params)
    const { sort: rawSort, params: sortParams } = getSortParams(params.query?.filters ?? [], params.query?.order_by)
    const sort = params.query?.nextCursorMark != null ? ensureIdSort(rawSort) : rawSort

    const requestBody = {
      ...request,
      sort,
      fields: fields.join(','),
      params: {
        ...request.params,
        ...highlightBLock,
        // add variables if there are any
        ...((params.query as any)?.['sv'] ?? {}),
        // any sort params
        ...sortParams,
        ...(params.query?.nextCursorMark != null ? { cursorMark: params.query.nextCursorMark } : {}),
      },
    }
    const results = await this.solr.select<SlimDocumentFields>(this.solr.namespaces.Search, {
      body: requestBody,
    })

    const contentItems = (results.response?.docs ?? ([] as SlimDocumentFields[]))
      .map(d => toContentItem(d, { maxScore: results.response?.maxScore }))
      .map(item => withMatches(item, results))

    // get data enrichment items
    const contentItemIds = contentItems.map(d => d.id)

    const [dbPages, collectionsLookup] = await Promise.all([
      this._findPages(contentItemIds),
      this.getCollections(contentItemIds, params.user),
    ])
    const resolvers = this.getCachedResolvers()
    const metadataResolvers = this.getContentItemMetadataResolvers()

    const enrichedContentItems = await enrichContentItems(contentItems, [
      withIIIF(dbPages, this.app),
      withTopics(resolvers.topic),
      withCollections(collectionsLookup),
      withMetaLabels(metadataResolvers),
      withAccessLabels(metadataResolvers),
      withTextLabels(metadataResolvers),
      withAuthorizationBitmaps,
    ])

    return {
      data: enrichedContentItems,
      offset: results.response?.start ?? 0,
      limit: request.limit ?? DefaultLimit,
      total: results.response?.numFound ?? 0,
      nextCursorMark: results.nextCursorMark,
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
    //         uid: { [Op.in]: results.data.map(d => d.id) },
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
    //     uid: { [Op.in]: results.data.map(d => d?.issue?.id) },
    //   },
    // }
    // const getRelatedIssuesPromise = measureTime(() => getIssues(issuesRequest, this.app!), 'articles.find.db.issues')

    // do the loop
    // const result = await Promise.all([getAddonsPromise, getRelatedIssuesPromise]).then(
    //   ([addonsIndex, issuesIndex]) => ({
    //     ...results,
    //     data: results.data.map((article: Article) => {
    //       if (article?.issue?.id != null && issuesIndex[article?.issue?.id]) {
    //         article.issue.accessRights = issuesIndex[article.issue.id].accessRights
    //       }
    //       if (!addonsIndex[article.id]) {
    //         debug('[find] no pages for uid', article.id)
    //         return article
    //       }
    //       // add pages
    //       if (addonsIndex[article.id].pages) {
    //         // NOTE [RK]: Checking type of object is a quick fix around cached
    //         // sequelized results. When a result is a plain Object instance it means
    //         // it came from cache. Otherwise it is a model instance and it was
    //         // loaded from the database.
    //         // This should be moved to the SequelizeService layer.
    //         const rewriteRules = this.app?.get('images')?.rewriteRules ?? []
    //         article.pages = addonsIndex[article.id].pages.map((d: any) =>
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
    //     item.locations = await Promise.all(item.locations?.map(item => resolvers.location(item.id)) ?? [])
    //     item.persons = await Promise.all(item.persons?.map(item => resolvers.person(item.id)) ?? [])
    //     return item
    //   })
    // )

    // return results
  }

  async get(id: string, params: GetParams): Promise<ContentItem> {
    // debug(`[get:${id}] with auth params:`, params.user ? params.user.uid : 'no user found')

    const request = findAllRequestAdapter({
      q: `id:${id}`,
      limit: 1,
      offset: 0,
      fl: isTrue(params.query?.include_embeddings) ? GetMethodFieldsWithEmbeddings : GetMethodFields,
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
      toContentItemWithMatches(result.response as IFragmentsAndHighlights, result?.response?.maxScore)
    ) ?? [])?.[0]

    if (!contentItem) throw new NotFound(`Content item with id ${id} not found`)

    const resolvers = this.getCachedResolvers()
    const metadataResolvers = this.getContentItemMetadataResolvers()

    const enrichedContentItem = (
      await enrichContentItems(
        [contentItem],
        [
          withIIIF(dbPagesLookup, this.app),
          withTopics(resolvers.topic),
          withCollections(collectionsLookup),
          withMetaLabels(metadataResolvers),
          withAccessLabels(metadataResolvers),
          withTextLabels(metadataResolvers),
          withAuthorizationBitmaps,
        ]
      )
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

    //         article.locations = await Promise.all(article.locations?.map(item => resolvers.location(item.id)) ?? [])
    //         article.persons = await Promise.all(article.persons?.map(item => resolvers.person(item.id)) ?? [])

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

export default function (options: ServiceOptions): IContentItemService {
  return new ContentItemService(options)
}
