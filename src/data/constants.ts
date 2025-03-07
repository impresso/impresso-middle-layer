import assert from 'assert'
import { constants, FilterType } from 'impresso-jscommons'
import { DataIndex } from './index'
import { SolrFacetQueryParams } from './types'

const facetRanges = new DataIndex({ name: 'facetRanges' })

function getRangeFacetValue(
  index: string,
  facet: string,
  key: 'min' | 'max',
  defaultValue: string | number
): string | number {
  const indexData = facetRanges.getValue(index) || {}
  const { [facet]: descriptor = {} } = indexData
  return descriptor[key] == null ? defaultValue : descriptor[key]
}

interface IStartEndGap {
  start: string | number
  end: string | number
  gap: string | number
}

export const isNumber = (value: any): value is number => typeof value === 'number' && Number.isFinite(value)

function getRangeFacetParametersWithDefault(
  index: string,
  facet: string,
  numBuckets: number,
  defaultParameters: IStartEndGap
): IStartEndGap {
  const start = getRangeFacetValue(index, facet, 'min', defaultParameters.start)
  const end = getRangeFacetValue(index, facet, 'max', defaultParameters.end)
  const gap = isNumber(start) && isNumber(end) ? Math.round((end - start) / numBuckets) : defaultParameters.gap
  return { start, end, gap }
}

interface ISolrMappings {
  facets: {
    [filterName: string]: SolrFacetQueryParams
  }
  orderBy?: Record<string, string>
  groupBy?: Record<string, string>
}

/**
 * Various SOLR mappings per index.
 */
export const SolrMappings: Record<string, ISolrMappings> = Object.freeze({
  search: {
    facets: {
      daterange: {
        type: 'range',
        field: 'meta_date_dt',
        ...getRangeFacetParametersWithDefault('search', 'daterange', 10, {
          start: '1700-01-01T00:00:00Z',
          end: '2021-01-01T00:00:00Z',
          gap: '+1YEAR',
        }),
        mincount: 1,
        // not supported for 'range' type
        // numBuckets: true,
      },
      year: {
        type: 'terms',
        field: 'meta_year_i',
        mincount: 1,
        limit: 400, // 400 years
        numBuckets: true,
      },
      contentLength: {
        type: 'range',
        field: 'content_length_i',
        end: 10000,
        start: 0,
        gap: 100,
        other: 'after',
      },
      month: {
        type: 'terms',
        field: 'meta_month_i',
        mincount: 1,
        limit: 120, // ten years granularity
        numBuckets: true,
      },
      country: {
        type: 'terms',
        field: 'meta_country_code_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      type: {
        type: 'terms',
        field: 'item_type_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      topic: {
        type: 'terms',
        field: 'topics_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      collection: {
        type: 'terms',
        field: 'ucoll_ss',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      /* Not yet in use. Will be related to "daterange" filter */
      // date: {
      //   type: 'terms',
      //   field: 'meta_date_dt',
      //   mincount: 1,
      //   limit: 100,
      // },
      language: {
        type: 'terms',
        field: 'lg_s',
        mincount: 1,
        numBuckets: true,
      },
      person: {
        type: 'terms',
        field: 'pers_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      location: {
        type: 'terms',
        field: 'loc_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      nag: {
        type: 'terms',
        field: 'nag_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      /**
       * @deprecated removed in Impresso 2.0. New field: rights_data_domain_s
       * https://github.com/impresso/impresso-middle-layer/issues/462
       */
      accessRight: {
        type: 'terms',
        field: 'access_right_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      partner: {
        type: 'terms',
        field: 'meta_partnerid_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      /**
       * Available in Impresso 2.0 only.
       */
      dataDomain: {
        type: 'terms',
        field: 'rights_data_domain_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      /**
       * Available in Impresso 2.0 only.
       */
      copyright: {
        type: 'terms',
        field: 'rights_copyright_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
    },
    orderBy: {
      date: 'meta_date_dt',
      relevance: 'score',
      id: 'id',
    },
    groupBy: {
      issues: 'meta_issue_id_s',
      articles: 'id',
      raw: 'id',
    },
  },
  tr_clusters: {
    facets: {
      newspaper: {
        type: 'terms',
        field: 'newspapers_ss',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      textReuseClusterSize: {
        type: 'range',
        field: 'cluster_size_l',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterSize', 10, {
          end: 100000,
          start: 0,
          gap: 10000,
        }),
      },
      textReuseClusterLexicalOverlap: {
        type: 'range',
        field: 'lex_overlap_d',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterLexicalOverlap', 10, {
          end: 100,
          start: 0,
          gap: 10,
        }),
      },
      textReuseClusterDayDelta: {
        type: 'range',
        field: 'day_delta_i',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterDayDelta', 10, {
          end: 100,
          start: 0,
          gap: 10,
        }),
      },
      daterange: {
        type: 'range',
        field: 'max_date_dt',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'daterange', 10, {
          start: '1700-01-01T00:00:00Z',
          end: '2021-01-01T00:00:00Z',
          gap: '+1YEAR',
        }),
      },
    },
  },
  tr_passages: {
    facets: {
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      type: {
        type: 'terms',
        field: 'item_type_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      daterange: {
        type: 'range',
        field: 'meta_date_dt',
        ...getRangeFacetParametersWithDefault('tr_passages', 'daterange', 10, {
          start: '1700-01-01T00:00:00Z',
          end: '2021-01-01T00:00:00Z',
          gap: '+1YEAR',
        }),
        mincount: 1,
        // not supported for 'range' type
        // numBuckets: true,
      },
      yearmonth: {
        type: 'terms',
        field: 'meta_yearmonth_s',
        mincount: 1,
        limit: 400 * 12, // 400 years x 12 months
        numBuckets: true,
      },
      year: {
        type: 'terms',
        field: 'meta_year_i',
        mincount: 1,
        limit: 400, // 400 years
        numBuckets: true,
      },
      connectedClusters: {
        type: 'terms',
        field: 'connected_clusters_ss',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      textReuseClusterSize: {
        type: 'range',
        field: 'cluster_size_l',
        end: 50000,
        start: 2,
        gap: 250,
      },
      textReuseClusterLexicalOverlap: {
        type: 'range',
        field: 'cluster_lex_overlap_d',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterLexicalOverlap', 200, {
          end: 100,
          start: 0,
          gap: 0.5,
        }),
      },
      textReuseClusterDayDelta: {
        type: 'range',
        field: 'cluster_day_delta_i',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterDayDelta', 800, {
          end: 80000,
          start: 0,
          gap: 100,
        }),
      },
      textReuseCluster: {
        type: 'terms',
        field: 'cluster_id_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      collection: {
        type: 'terms',
        field: 'ucoll_ss',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      topic: {
        type: 'terms',
        field: 'topics_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      person: {
        type: 'terms',
        field: 'pers_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      location: {
        type: 'terms',
        field: 'loc_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      nag: {
        type: 'terms',
        field: 'nag_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      language: {
        type: 'terms',
        field: 'lg_s',
        mincount: 1,
        numBuckets: true,
      },
      country: {
        type: 'terms',
        field: 'meta_country_code_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
    },
  },
  images: {
    facets: {
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      year: {
        type: 'terms',
        field: 'meta_year_i',
        mincount: 1,
        limit: 400, // 400 years
        numBuckets: true,
      },
    },
  },
})

/* Check that facets are a subset of filter types */
Object.keys(SolrMappings.search.facets).forEach(type =>
  assert(constants.filter.Types.includes(type as FilterType), `Unknown filter type found in facets: ${type}`)
)

export const FilterTypes = constants.filter.Types
export const Contexts = constants.filter.Contexts
export const Operators = constants.filter.Operators
export const Precision = constants.filter.Precision
