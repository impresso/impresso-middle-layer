import { SolrNamespace } from '@/solr.js'
import { QueryTypes, type Sequelize } from 'sequelize'
import { Bucket, SelectRequestBody, SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { MediaSource } from '@/models/generated/canonical.js'
import { logger } from '@/logger.js'

const sqlGetNewsappersDetails = `
SELECT
  n.id as id,
  n.title as name,
  n.start_year as publishedFromYear,
  n.end_year as publishedToYear,
  me_medium.label as sourceMediumLabel,
  me_type.label as sourceTypeLabel,
  (SELECT COUNT(*) FROM issues WHERE newspaper_id = n.id) AS issueCount,
  (SELECT COUNT(*) FROM pages p JOIN issues i ON p.issue_id = i.id WHERE i.newspaper_id = n.id) AS pageCount,
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
FROM newspapers n
LEFT JOIN meta_entities me_medium ON n.source_medium_id = me_medium.id
LEFT JOIN meta_entities me_type ON n.source_type_id = me_type.id;
`

interface NewspaperProperty {
  id: string
  label: string
  value: string
}

export interface DBNewspaperDetails {
  id: string
  name: string
  publishedFromYear?: number
  publishedToYear?: number
  issueCount: number
  pageCount: number
  sourceMediumLabel: string
  sourceTypeLabel: string
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
      limit: -1, // -1 = no limit.
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
  logger.info('Consolidating media sources from DB and Solr...')
  const [solrResponse, dbNewspapersDetails] = await Promise.all([
    solrClient.select<unknown, 'sources', FacetBucket>(solrIndex, { body: articlesCountSolrQuery }),
    dbClient.query<DBNewspaperDetails>(sqlGetNewsappersDetails, {
      type: QueryTypes.SELECT,
    }),
  ])
  logger.info(`Found ${dbNewspapersDetails.length} newspapers in DB.`)
  logger.info(`Found ${solrResponse.facets?.sources?.buckets?.length ?? 0} newspaper sources in Solr.`)

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
    const articlesCount = articlesCounts[dbNewspaper.id] ?? 0
    const datesRange = datesRanges[dbNewspaper.id] ?? undefined

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
      id: dbNewspaper.id,
      type: dbNewspaper.sourceTypeLabel as MediaSource['type'],
      medium: dbNewspaper.sourceMediumLabel as MediaSource['medium'],
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
