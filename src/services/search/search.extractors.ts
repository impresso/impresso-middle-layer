import { keyBy, isEmpty, assignIn, clone, isUndefined, fromPairs } from 'lodash'
import Article from '../../models/articles.model'
import Newspaper from '../../models/newspapers.model'
import Topic from '../../models/topics.model'
import Entity from '../../models/entities.model'
import Year from '../../models/years.model'
import { filtersToQueryAndVariables, getRegionCoordinatesFromDocument } from '../../util/solr'
import { Service } from '../articles/articles.class'

function getAricleMatchesAndRegions(
  article: Article | undefined,
  documentsIndex: Record<string, any>,
  fragmentsIndex: Record<string, any>,
  highlightingIndex: Record<string, any>
) {
  if (article == null) return [[], []]

  const { uid: id, language } = article

  const fragments = fragmentsIndex[id][`content_txt_${language}`]
  const highlights = highlightingIndex[id][`content_txt_${language}`]

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
  articlesService: Service,
  userInfo: { user?: any; authenticated?: boolean } = {}
) {
  const { user, authenticated } = userInfo

  const documentsIndex = keyBy(response.response.docs, 'id')
  const uids = response.response.docs.map((d: { id: string }) => d.id)

  if (isEmpty(uids)) return []

  const { fragments: fragmentsIndex, highlighting: highlightingIndex } = response

  const filters = [{ type: 'uid', q: uids }]
  const { query } = filtersToQueryAndVariables(filters)

  const articlesRequest = {
    user,
    authenticated,
    query: {
      limit: uids.length,
      filters,
      sq: query,
    },
  }

  const articlesIndex = keyBy((await articlesService.findInternal(articlesRequest)).data, 'uid')

  return uids.map((uid: string) => {
    const article = articlesIndex[uid]
    const [matches, regions] = getAricleMatchesAndRegions(article, documentsIndex, fragmentsIndex, highlightingIndex)
    return Article.assignIIIF(assignIn(clone(article), { matches, regions }))
  })
}

async function addCachedItems(
  bucket: { val: any },
  provider: typeof Newspaper | typeof Topic | typeof Entity | typeof Year
) {
  if (isUndefined(provider)) return bucket
  return {
    ...bucket,
    item: await provider.getCached(bucket.val),
    uid: bucket.val,
  }
}

const CacheProvider = {
  newspaper: Newspaper,
  topic: Topic,
  person: Entity,
  location: Entity,
  year: Year,
}

/**
 * Extract facets from Solr response.
 * @param {object} response Solr response
 * @return {object} facets object.
 */
export async function getFacetsFromSolrResponse(response: { facets?: Record<string, { buckets?: object[] }> }) {
  const { facets = {} } = response

  const facetPairs = await Promise.all(
    Object.keys(facets).map(async facetLabel => {
      if (!facets[facetLabel].buckets) return [facetLabel, facets[facetLabel]]
      const cacheProvider = CacheProvider[facetLabel as keyof typeof CacheProvider]
      const buckets = await Promise.all(
        facets[facetLabel].buckets.map(async (b: any) => addCachedItems(b, cacheProvider))
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
