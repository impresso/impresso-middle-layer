import { QueryTypes, type Sequelize } from 'sequelize'
import { MediaSource } from '../models/generated/schemas'
import { SelectRequestBody, SimpleSolrClient } from '../schema/simpleSolr'

const sqlGetNewsappersDetails = `
SELECT
    n.id as uid,
    n.title as name,
    n.start_year as startYear,
    n.end_year as endYear,
    COUNT(DISTINCT i.id) AS issueCount,
    COUNT(p.id) AS pageCount,
    (
		  SELECT JSON_ARRAYAGG(l.code)
      FROM newspapers_languages AS nl
      LEFT JOIN languages AS l ON l.id=nl.language_id
      WHERE nl.newspaper_id=n.id
	  ) AS languageCodes
FROM
    newspapers n
    LEFT JOIN issues i ON n.id = i.newspaper_id
    LEFT JOIN pages p ON i.id = p.issue_id
WHERE n.id = 'ZBT'
GROUP BY n.id;
`

export interface DBNewspaperDetails {
  uid: string
  name: string
  startYear: number
  endYear: number
  issueCount: number
  pageCount: number
  languageCodes: string[]
}

const articlesCountSolrQuery: SelectRequestBody = {
  query: 'filter(content_length_i:[1 TO *])',
  facet: {
    sources: {
      type: 'terms',
      field: 'meta_journal_s',
      mincount: 1,
      limit: Number.MAX_SAFE_INTEGER, // A magic number. We expect it to never have more than this many sources.
    },
  },
  limit: 0,
  offset: 0,
}

/**
 * Collect data representing media sources from both the database
 * and Solr and write it using `writer`.
 *
 * @returns The number of media sources written.
 */
export const consolidateMediaSources = async (
  dbClient: Sequelize,
  solrClient: SimpleSolrClient
): Promise<MediaSource[]> => {
  const [solrResponse, dbNewspapersDetails] = await Promise.all([
    solrClient.select<unknown, 'sources'>({ body: articlesCountSolrQuery }),
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

  const mediaSources = dbNewspapersDetails.map(dbNewspaper => {
    const articlesCount = articlesCounts[dbNewspaper.uid] ?? 0
    return {
      uid: dbNewspaper.uid,
      type: 'newspaper',
      name: dbNewspaper.name,
      languageCodes: dbNewspaper.languageCodes,
      yearsRange: [dbNewspaper.startYear, dbNewspaper.endYear],
      totals: {
        articles: articlesCount,
        issues: dbNewspaper.issueCount,
        pages: dbNewspaper.pageCount,
      },
    } satisfies MediaSource
  })

  return mediaSources
}
