// @ts-check
const assert = require('assert');
const { uniq, includes, groupBy } = require('lodash');
const { filtersToSolr, escapeValue } = require('./filterReducers');
const { SolrNamespaces } = require('../../solr');

/**
 * Languages that have content indexes in Solr.
 */
const ContentLanguages = [
  'en', 'fr', 'de',
];

/**
 * Fields names that should not be wrapped into `filter(...)` when
 * used in `q` Solr parameter.
 *
 * TODO: Explain why.
 */
const NON_FILTERED_FIELDS = [
  'uid',
  'string',
  'entity-string',
  'topic-string',
];

/**
 * Translate DPF filter to appropriate field names
 * @type {Object}
 */
const SOLR_FILTER_DPF = {
  topic: 'topics_dpfs',
  person: 'pers_entities_dpfs',
  location: 'loc_entities_dpfs',
};

const reduceFiltersToVars = filters => filters.reduce((sq, filter) => {
  if (Array.isArray(filter.q)) {
    filter.q.forEach((q) => {
      sq.push(q);
    });
  } else {
    sq.push(filter.q);
  }
  return sq;
}, []);

/**
 * Return a section of the Solr query based on the filters **of the same type**.
 * @param {array} filters a list of filters (`src/schema/search/filter.json`).
 * @param {string} solrNamespace index to use (see `src/solr.js` - `SolrNamespaces`)
 * @return {string} a Solr query.
 */
function sameTypeFiltersToQuery(filters, solrNamespace = SolrNamespaces.Search) {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`);

  const filtersTypes = uniq(filters.map(f => f.type));
  assert.equal(filtersTypes.length, 1, `Filters must be of the same type but they are of: ${filtersTypes.join(', ')}`);

  const type = filtersTypes[0];
  const statement = filtersToSolr(filters, solrNamespace);

  return includes(NON_FILTERED_FIELDS, type)
    ? statement
    : `filter(${statement})`;
}

/**
 * @typedef SolrQueryAndVariables
 * @property {string} query Solr query string (`q` field)
 * @property {Object.<string, string>} variables variables that are referenced in `query`
 */

/**
 * Return Solr query string and referenced variables for a set of filters.
 * @param {Array<object>} filters a list of filters of type `src/schema/search/filter.json`.
 * @param {string} solrNamespace index to use (see `src/solr.js` - `SolrNamespaces`)
 * @return {SolrQueryAndVariables}
 */
function filtersToQueryAndVariables(filters, solrNamespace = SolrNamespaces.Search) {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`);

  const filtersGroupedByType = groupBy(filters, 'type');

  /** @type {Object.<string, string>} */
  const variables = {};
  const queries = [];

  Object.keys(filtersGroupedByType).forEach((key) => {
    if (NON_FILTERED_FIELDS.indexOf(key) !== -1) {
      queries.push(filtersToSolr(filtersGroupedByType[key], solrNamespace));
    } else {
      queries.push(`filter(${filtersToSolr(filtersGroupedByType[key], solrNamespace)})`);
    }
    if (SOLR_FILTER_DPF[key]) {
      // add payload variable. E.g.: payload(topics_dpf,tmGDL_tp04_fr)
      reduceFiltersToVars(filtersGroupedByType[key]).forEach((d) => {
        const l = Object.keys(variables).length;
        const field = SOLR_FILTER_DPF[key];
        variables[`v${l}`] = `payload(${field},${escapeValue(d)})`;
      });
    }
  });

  return {
    query: queries.length ? queries.join(' AND ') : '*:*',
    variables,
  };
}

function getRegionCoordinatesFromDocument(document) {
  if (document.rc_plains) {
    const rcPlainsArray = typeof document.rc_plains === 'string'
      ? [document.rc_plains] : document.rc_plains;
    return rcPlainsArray.map((d) => {
      const page = JSON.parse(d.replace(/'/g, '"'));
      return {
        id: page.pid,
        r: page.c,
      };
    });
  }
  if (document.pp_plain) {
    return document.pp_plain;
  }
  return [];
}


module.exports = {
  sameTypeFiltersToQuery,
  filtersToQueryAndVariables,
  ContentLanguages,
  getRegionCoordinatesFromDocument,
};
