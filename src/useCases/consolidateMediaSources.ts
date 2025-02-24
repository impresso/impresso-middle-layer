import { SolrNamespace } from '../solr'
import { QueryTypes, type Sequelize } from 'sequelize'
import { Bucket, SelectRequestBody, SimpleSolrClient } from '../internalServices/simpleSolr'
import { MediaSource } from '../models/generated/schemas'

const sqlGetNewsappersDetails = `
SELECT
  n.id as uid,
  n.title as name,
  n.start_year as publishedFromYear,
  n.end_year as publishedToYear,
  COUNT(DISTINCT i.id) AS issueCount,
  COUNT(p.id) AS pageCount,
  (
    SELECT JSON_ARRAYAGG(l.code)
    FROM newspapers_languages AS nl
    LEFT JOIN languages AS l ON l.id=nl.language_id
    WHERE nl.newspaper_id=n.id
  ) AS languageCodes,
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', mp.name,
        'label', mp.label,
        'value', nm.value
      )
    )
    FROM newspapers_metadata nm
    JOIN meta_properties mp ON nm.property_id = mp.id
    WHERE nm.newspaper_id=n.id AND nm.value IS NOT NULL
  ) AS properties
FROM
    newspapers n
    LEFT JOIN issues i ON n.id = i.newspaper_id
    LEFT JOIN pages p ON i.id = p.issue_id
GROUP BY n.id;
`

interface NewspaperProperty {
  id: string
  label: string
  value: string
}

export interface DBNewspaperDetails {
  uid: string
  name: string
  publishedFromYear?: number
  publishedToYear?: number
  issueCount: number
  pageCount: number
  languageCodes: string[]
  properties: NewspaperProperty[]
}

const articlesCountSolrQuery: SelectRequestBody = {
  query: 'filter(content_length_i:[1 TO *])',
  facet: {
    sources: {
      type: 'terms',
      field: 'meta_journal_s',
      mincount: 1,
      limit: Number.MAX_SAFE_INTEGER, // A magic number. We expect it to never have more than this many sources.
      facet: {
        minDate: 'min(meta_date_dt)',
        maxDate: 'max(meta_date_dt)',
      },
    },
  },
  limit: 0,
  offset: 0,
}

export interface FacetBucket extends Bucket {
  val: string
  count: number
  minDate: string
  maxDate: string
}

/**
 * Collect data representing media sources from both the database
 * and Solr and write it using `writer`.
 *
 * @returns The number of media sources written.
 */
export const consolidateMediaSources = async (
  dbClient: Sequelize,
  solrClient: SimpleSolrClient,
  solrIndex: SolrNamespace
): Promise<MediaSource[]> => {
  const [solrResponse, dbNewspapersDetails] = await Promise.all([
    solrClient.select<unknown, 'sources', FacetBucket>(solrIndex, { body: articlesCountSolrQuery }),
    dbClient.query<DBNewspaperDetails>(sqlGetNewsappersDetails, {
      type: QueryTypes.SELECT,
    }),
  ])

  const articlesCountsBuckets = solrResponse.facets?.sources?.buckets ?? []
  const articlesCounts = articlesCountsBuckets.reduce<Record<string, number>>((counts, bucket) => {
    const k = String(bucket.val!)
    const v = bucket.count ?? 0
    return { ...counts, [k]: v }
  }, {})
  const datesRanges = articlesCountsBuckets.reduce<Record<string, [Date, Date]>>((ranges, bucket) => {
    const k = String(bucket.val!)
    const minDate = new Date(bucket['minDate'] ?? 0)
    const maxDate = new Date(bucket['maxDate'] ?? 0)

    return { ...ranges, [k]: [minDate, maxDate] }
  }, {})

  const mediaSources = dbNewspapersDetails.map(dbNewspaper => {
    const articlesCount = articlesCounts[dbNewspaper.uid] ?? 0
    const datesRange = datesRanges[dbNewspaper.uid] ?? undefined

    const datesRangePart: Pick<MediaSource, 'availableDatesRange'> =
      datesRange != null
        ? {
            availableDatesRange: [datesRange[0].toISOString(), datesRange[1].toISOString()],
          }
        : {}
    const publishedPeriodYearsPart: Pick<MediaSource, 'publishedPeriodYears'> =
      dbNewspaper.publishedFromYear != null && dbNewspaper.publishedToYear
        ? { publishedPeriodYears: [dbNewspaper.publishedFromYear ?? 1970, dbNewspaper.publishedToYear ?? 1970] }
        : {}

    return {
      uid: dbNewspaper.uid,
      type: 'newspaper',
      name: dbNewspaper.name,
      languageCodes: dbNewspaper.languageCodes,
      ...datesRangePart,
      ...publishedPeriodYearsPart,
      totals: {
        articles: articlesCount,
        issues: dbNewspaper.issueCount,
        pages: dbNewspaper.pageCount,
      },
      properties: dbNewspaper.properties,
    } satisfies MediaSource
  })

  return mediaSources
}
