/**
 * @deprecated - remove when articles-search is removed but check that this file is not used elsewhere.
 */
import { keyBy, isEmpty, assignIn, clone, isUndefined, fromPairs } from 'lodash'
import Article, { IFragmentsAndHighlights } from '../../models/articles.model'
import { filtersToQueryAndVariables, getRegionCoordinatesFromDocument } from '../../util/solr'
import { ContentItemService } from '../content-items/content-items.class'
import { ImpressoApplication } from '../../types'
import { buildResolvers, CachedFacetType, IResolver } from '../../internalServices/cachedResolvers'
import { ContentItem } from '../../models/generated/schemas/contentItem'
import { SolrServerNamespaceConfiguration } from '../../models/generated/common'
import { SolrNamespaces } from '../../solr'
import { Filter } from 'impresso-jscommons'

export const getContentItemMatches = (
  contentItem: ContentItem,
  ppPlain: string | undefined,
  { fragments, highlighting }: IFragmentsAndHighlights
) => {
  const { id, text } = contentItem
  const langCode = text?.langCode

  const contentLocators = ['content_txt', ...(langCode != null ? [`content_txt_${langCode}`] : [])]

  const contentItemFragment = contentLocators.reduce((foundContent, locator) => {
    if (foundContent.length > 0) return foundContent
    return fragments?.[id]?.[locator] ?? []
  }, [])
  const contentItemHighlight = contentLocators.reduce((foundContent, locator) => {
    if (Object.keys(foundContent).length > 0) return foundContent
    return highlighting?.[id]?.[locator] ?? {}
  }, {})

  return Article.getMatches({
    solrDocument: { pp_plain: ppPlain },
    highlights: contentItemHighlight,
    fragments: contentItemFragment,
  })
}

function getAricleMatchesAndRegions(
  article: ContentItem | undefined,
  documentsIndex: Record<string, any>,
  fragmentsIndex: Record<string, any>,
  highlightingIndex: Record<string, any>
) {
  if (article == null) return [[], []]

  const { id, text } = article
  const langCode = text?.langCode

  const contentLocators = ['content_txt', ...(langCode != null ? [`content_txt_${langCode}`] : [])]

  const fragments = contentLocators.reduce((foundContent, locator) => {
    if (foundContent) return foundContent
    return fragmentsIndex[id]?.[locator]
  }, undefined)
  const highlights = contentLocators.reduce((foundContent, locator) => {
    if (foundContent) return foundContent
    return highlightingIndex[id]?.[locator]
  }, undefined)

  const matches = Article.getMatches({
    solrDocument: documentsIndex[id],
    highlights,
    fragments,
  })

  const regionCoords: any[] = getRegionCoordinatesFromDocument(documentsIndex[id])
  const regions = Article.getRegions({
    regionCoords,
  } as any)

  return [matches, regions]
}

/**
 * Extracts matching documents from Solr response as `Article` items.
 * @param {object} response Solr search response.
 * @param {Service} articlesService service used to fetch articles content by their Ids.
 * @param {object} userInfo - a `{ user, authenticated }` object used to manage
 *                            authorisation of the content.
 *
 * @return {array} a list of `Article` items.
 */
export async function getItemsFromSolrResponse(
  response: any,
  articlesService: ContentItemService,
  userInfo: { user?: any; authenticated?: boolean } = {},
  solrNamespacesConfiguration: SolrServerNamespaceConfiguration[]
) {
  const { user, authenticated } = userInfo

  const documentsIndex = keyBy(response.response.docs, 'id')
  const uids = response.response.docs.map((d: { id: string }) => d.id)

  if (isEmpty(uids)) return []

  const { fragments: fragmentsIndex, highlighting: highlightingIndex } = response

  const filters: Filter[] = [{ type: 'uid', q: uids }]
  const { query, filter } = filtersToQueryAndVariables(filters, SolrNamespaces.Search, solrNamespacesConfiguration)

  const articlesRequest = {
    user,
    authenticated,
    query: {
      limit: uids.length,
      filters,
      sq: query as string,
      sfq: filter,
    },
  }

  const articlesIndex = keyBy((await articlesService.findInternal(articlesRequest)).data, 'uid')

  return uids.map((uid: string) => {
    const article = articlesIndex[uid]
    const [matches, regions] = getAricleMatchesAndRegions(article, documentsIndex, fragmentsIndex, highlightingIndex)
    return Article.assignIIIF(assignIn(clone(article), { matches, regions }) as any)
  })
}

async function addCachedItems(bucket: { val: any }, resolver: IResolver<any>, type: CachedFacetType) {
  if (isUndefined(resolver)) return bucket
  return {
    ...bucket,
    item: await resolver(bucket.val),
    uid: bucket.val,
  }
}

/**
 * Extract facets from Solr response.
 * @param {object} response Solr response
 * @return {object} facets object.
 */
export async function getFacetsFromSolrResponse(
  response: { facets?: Record<string, { buckets?: object[] }> },
  app: ImpressoApplication
) {
  const { facets = {} } = response

  const resolvers = buildResolvers(app)

  const facetPairs = await Promise.all(
    Object.keys(facets).map(async facetLabel => {
      if (!facets[facetLabel].buckets) return [facetLabel, facets[facetLabel]]
      const resolver = resolvers[facetLabel as CachedFacetType]
      const buckets = await Promise.all(
        facets[facetLabel].buckets.map(async (b: any) => addCachedItems(b, resolver, facetLabel as CachedFacetType))
      )

      return [facetLabel, assignIn(clone(facets[facetLabel]), { buckets })]
    })
  )

  return fromPairs(facetPairs)
}

/**
 * Extract total number of matched documents.
 * @param {object} response Solr response.
 * @return {number}
 */
export function getTotalFromSolrResponse(response?: { response?: { numFound?: number } }) {
  return response?.response?.numFound ?? 0
}
