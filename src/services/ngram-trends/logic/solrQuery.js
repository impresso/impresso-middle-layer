const moment = require('moment');
const {
  get, mergeWith, toPairs,
  fromPairs, sortBy, sum,
} = require('lodash');
const {
  filtersToQueryAndVariables,
  ContentLanguages,
} = require('../../../util/solr');

const {
  getFacetsFromSolrResponse,
} = require('../../../services/search/search.extractors');
const { SOLR_FACETS } = require('../../../hooks/search');

const TimeIntervalsFilelds = {
  year: 'meta_year_i',
  month: 'meta_yearmonth_s',
  day: 'meta_date_dt',
};

const getFacetPivotString = (languageCode, timeIntervalField) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  `{!stats=tf_stats_${languageCode} key=${languageCode}}${timeIntervalField}`;
const getStatsFieldString = (languageCode, unigram) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  `{!tag=tf_stats_${languageCode} key=tf_stats_${languageCode} sum=true func}termfreq(content_txt_${languageCode},'${unigram}')`;

/**
 * Construct a SOLR query to get unigram trends.
 * The query is a JSON payload to be send as a POST request.
 *
 * @param {string} unigram unigram to get trends for.
 * @param {object[]} filters a list of filters of type `src/schema/search/filter.json`.
 * @param {string[]} facets a list of facets to extract alongside trend.
 *
 * @return {object} a POST JSON payload for SOLR search endpoint.
 */
function unigramTrendsRequestToSolrQuery(unigram, filters, facets = [], timeInterval = 'year') {
  const { query, variables } = filtersToQueryAndVariables(filters);
  const timeIntervalField = TimeIntervalsFilelds[timeInterval];

  const facetPivots = ContentLanguages
    .map(languageCode => getFacetPivotString(languageCode, timeIntervalField));
  const statsFields = ContentLanguages
    .map(languageCode => getStatsFieldString(languageCode, unigram));

  return {
    query,
    limit: 0,
    params: {
      vars: variables,
      facet: true,
      'facet.pivot': facetPivots,
      'stats.field': statsFields,
      stats: true,
      'json.facet': JSON.stringify(facets.reduce((acc, facet) => {
        acc[facet] = SOLR_FACETS[facet];
        return acc;
      }, {})),
      hl: false, // disable duplicate field "highlighting"
    },
  };
}

const mergeFn = (dst, src) => (dst || 0) + (src || 0);

/**
 * Convert raw SOLR response to `ngram-trends/schema/post/response.json`.
 * @param {object} solrResponse SOLR trends response
 */
async function parseUnigramTrendsResponse(solrResponse, unigram, timeInterval) {
  const pivots = get(solrResponse, 'facet_counts.facet_pivot', {});
  const languageCodes = Object.keys(pivots);
  const domainToValuesMapping = languageCodes.reduce((acc, languageCode) => {
    const pivotEntries = pivots[languageCode];
    const entries = pivotEntries.map((entry) => {
      const key = entry.value;
      const value = get(entry, `stats.stats_fields.tf_stats_${languageCode}.sum`);
      return [key, value];
    });
    return mergeWith(acc, fromPairs(entries), mergeFn);
  }, {});

  const domainAndValueItems = sortBy(toPairs(domainToValuesMapping), ([domain]) => domain);

  const domainValues = domainAndValueItems.map(([domain]) => domain);
  const values = domainAndValueItems.map(([, value]) => value);
  const facets = await getFacetsFromSolrResponse(solrResponse);
  const time = get(solrResponse, 'responseHeader.QTime');

  const total = sum(values);

  return {
    trends: [
      {
        ngram: unigram,
        values,
        total,
      },
    ],
    domainValues,
    timeInterval,
    info: {
      responseTime: {
        solr: time,
      },
      facets,
    },
  };
}

const DaterangeFilterValueRegex = /([^\s]+)\s+TO\s+([^\s]+)/;

function getTimedeltaInDaterangeFilter(daterangeFilter) {
  const value = daterangeFilter.q[0];
  const matches = DaterangeFilterValueRegex.exec(value);
  if (matches.length !== 3) return undefined;
  if (daterangeFilter.context === 'exclude') return undefined;

  const [fromDate, toDate] = matches.slice(1).map(v => moment.utc(v));
  const years = moment.duration(toDate.diff(fromDate)).as('years');
  return years;
}

function guessTimeIntervalFromFilters(filters = []) {
  const daterangeFilters = filters.filter(({ type }) => type === 'daterange');
  const timedeltas = daterangeFilters
    .map(getTimedeltaInDaterangeFilter)
    .filter(v => v !== undefined)
    .sort();
  const shortestTimedelta = timedeltas[0];
  // eslint-disable-next-line no-restricted-globals
  if (!isFinite(shortestTimedelta)) return 'year';

  if (shortestTimedelta < 1) return 'day';
  if (shortestTimedelta < 5) return 'month';
  return 'year';
}

module.exports = {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
};
