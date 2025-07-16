import { SolrFacetQueryParams } from '../data/types'
import { Bucket, SelectRequestBody, SimpleSolrClient } from '../internalServices/simpleSolr'
import { IYear } from '../models/years.model'
import { ImageSimilarityVectorField } from '../services/images/images.class'

const MaxYears = 10000 // total number of years to fetch. Adjust as needed

const yearFacetQuery: SolrFacetQueryParams = {
  type: 'terms',
  field: 'meta_year_i',
  mincount: 1,
  limit: MaxYears,
}

const getYearFacetRequestBody = (query: string): SelectRequestBody => ({
  query,
  offset: 0,
  limit: 0,
  facet: {
    year: yearFacetQuery,
  },
})

interface IYearBucket extends Omit<Bucket, 'val'> {
  val: number
  count: number
}

/**
 * Fetches and aggregates year counts from Solr.
 */
export const prepareAvailableYearBuckets = async (
  solrClient: SimpleSolrClient,
  imageSimilarityVectorField: string = ImageSimilarityVectorField
): Promise<Record<number, IYear>> => {
  const years: Record<number, IYear> = {}

  // 1. Get total content items per year
  const contentItemsRequestBody = getYearFacetRequestBody('*:*')
  // 2. Get articles (with text content) per year
  const contentItemsWithContentRequestBody = getYearFacetRequestBody('content_length_i:[1 TO *]')
  // 3. Get images per year
  const q = `{!func}exists(${imageSimilarityVectorField})`
  // Statement below does not work because of:
  // "Range Queries are not supported for Dense Vector fields. Please use the {!knn} query parser to run K nearest neighbors search queries."
  // const q = `filter(${imageSimilarityVectorField}:[* TO *])`
  const imagesRequestBody: SelectRequestBody = getYearFacetRequestBody(q)

  const [contentItemsResponse, contentItemsWithContentResponse, imagesResponse] = await Promise.all([
    solrClient.select<unknown, 'year', IYearBucket>(solrClient.namespaces.Search, { body: contentItemsRequestBody }),
    solrClient.select<unknown, 'year', IYearBucket>(solrClient.namespaces.Search, {
      body: contentItemsWithContentRequestBody,
    }),
    solrClient.select<unknown, 'year', IYearBucket>(solrClient.namespaces.Images, { body: imagesRequestBody }),
  ])

  contentItemsResponse.facets?.year?.buckets?.forEach(bucket => {
    years[bucket.val] = {
      y: bucket.val,
      refs: {
        c: bucket.count,
      },
    }
  })

  contentItemsWithContentResponse.facets?.year?.buckets?.forEach(bucket => {
    if (years[bucket.val]) {
      const item = years[bucket.val]
      if (item.refs == null) {
        item.refs = {}
      }
      item.refs.a = bucket.count
    }
    // Handle case where a year might appear here but not in the first query
    else {
      years[bucket.val] = { y: bucket.val, refs: { a: bucket.count } }
    }
  })

  imagesResponse.facets?.year?.buckets?.forEach(bucket => {
    if (years[bucket.val]) {
      const item = years[bucket.val]
      if (item.refs == null) {
        item.refs = {}
      }
      item.refs.m = bucket.count
    }
    // Handle case where a year might appear here but not in the first query
    else {
      years[bucket.val] = { y: bucket.val, refs: { m: bucket.count } }
    }
  })

  return years
}
