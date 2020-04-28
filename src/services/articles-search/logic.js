// @ts-check

/**
 * @typedef {import('.').RelevanceContextItem} RelevanceContextItem
 * @typedef {import('.').RelevanceContextItemType} RelevanceContextItemType
 * @typedef {import('.').TimeRangeContextParameters} TimeRangeContextParameters
 * @typedef {import('.').ItemContextParameters} ItemContextParameters
 */

const RelevanceContextItemTypes = Object.freeze({
  TimeRange: /** @type {RelevanceContextItemType} */ ('timeRange'),
  Locations: /** @type {RelevanceContextItemType} */ ('locations'),
  Persons: /** @type {RelevanceContextItemType} */ ('persons'),
  Topics: /** @type {RelevanceContextItemType} */ ('topics'),
  TextReuseClusters: /** @type {RelevanceContextItemType} */ ('textReuseClusters'),
});

/** @type {{ [key: string]: string }} */
const ContextTypeSolrFields = Object.freeze({
  timeRange: 'meta_year_i',
  locations: 'loc_entities_dpfs',
  persons: 'pers_entities_dpfs',
  topics: 'topics_dpfs',
  textReuseClusters: 'cluster_id_ss',
});

/**
 *
 * @param {TimeRangeContextParameters} parameters
 * @returns {string}
 */
function timeRangeFormula({ startYear, endYear }) {
  if (startYear != null && endYear == null) {
    return `
      if(
        gte(meta_year_i,${startYear}),
        1.0,
        0.0
      )`;
  }
  if (startYear == null && endYear != null) {
    return `
      if(
        lte(meta_year_i,${endYear}),
        1.0,
        0.0
      )`;
  }
  if (startYear != null && endYear != null) {
    return `
      if(
        and(
          lte(meta_year_i,${endYear}),
          gte(meta_year_i,${startYear})
        ),
        1.0,
        0.0
      )`;
  }
  return '1.0';
}

/**
 * @param {RelevanceContextItemType} type
 * @param {ItemContextParameters} itemContextParameters
 * @returns {string}
 */
function itemContextFormula(type, { entities }) {
  const solrField = ContextTypeSolrFields[type];
  const items = entities.map(entity => `
    mul(
      payload(${solrField},${entity.id}),
      ${entity.weight}
    )`);

  if (items.length > 1) {
    return `sum(${items.join(',')})`;
  }
  if (items.length === 1) {
    return items[0];
  }
  return '1.0';
}

/**
 * @param {RelevanceContextItemType} type
 * @param {ItemContextParameters} itemContextParameters
 * @returns {string}
 */
function textReuseItemContextFormula(type, { entities }) {
  const solrField = ContextTypeSolrFields[type];
  const items = entities.map(entity => `
    mul(
      exists(query({!df=${solrField} v=${entity.id}})),
      ${entity.weight}
    )`);

  if (items.length > 1) {
    return `sum(${items.join(',')})`;
  }
  if (items.length === 1) {
    return items[0];
  }
  return '1.0';
}

/**
 * @param {RelevanceContextItem} relevanceContextItem
 * @returns {string}
 */
function relevanceContextItemToSolrFormula({ type, parameters, weight }) {
  let parametersFormula = '1.0';
  // eslint-disable-next-line no-restricted-globals
  const w = isFinite(weight) ? weight : '1.0';

  if (type === RelevanceContextItemTypes.TimeRange) {
    parametersFormula = timeRangeFormula(/** @type {TimeRangeContextParameters} */ (parameters));
  } else if (type === RelevanceContextItemTypes.TextReuseClusters) {
    parametersFormula = textReuseItemContextFormula(
      type, /** @type {ItemContextParameters} */ (parameters),
    );
  } else {
    parametersFormula = itemContextFormula(type, /** @type {ItemContextParameters} */ (parameters));
  }
  return `mul(${parametersFormula},${w})`.replace(/(\s+\n)|(\n\s+)|(\n)/g, '');
}

/**
 * @param {RelevanceContextItem[]} relevanceContextItems
 * @returns {string}
 */
function relevanceContextItemsToSolrFormula(relevanceContextItems) {
  const items = relevanceContextItems.map(relevanceContextItemToSolrFormula);
  if (items.length === 0) return '1.0';
  if (items.length === 1) return items[0];
  return `sum(${items.join(',')})`;
}

const DefaultArticleFields = [
  'id',
  'rc_plain',
  'lg_s',
];

const CustomScoringField = 'customScore';

/**
 * Build Solr POST search request payload.
 * @param {string} query
 * @param {string} scroingVariable
 * @param {{ skip?: number, limit?: number }} options
 * @returns {any}
 */
function buildSolrQuery(query, scroingVariable, options = {}) {
  return {
    query,
    fields: DefaultArticleFields.concat([`$${CustomScoringField}`]),
    sort: `$${CustomScoringField} desc`,
    offset: options.skip,
    limit: options.limit,
    params: {
      hl: true,
      'hl.fl': 'content_txt_*',
      'hl.snippets': 10,
      'hl.fragsize': 100,
      [CustomScoringField]: scroingVariable,
    },
  };
}

/**
 * Add score to article items
 * @param {any} solrResponse
 */
function withScore(solrResponse) {
  const itemIdToScore = solrResponse.response.docs
    .reduce((acc, doc) => ({ ...acc, [doc.id]: doc[`$${CustomScoringField}`] }), {});

  return (articleItem) => {
    const score = itemIdToScore[articleItem.uid];
    return {
      ...articleItem,
      score,
    };
  };
}

module.exports = {
  relevanceContextItemToSolrFormula,
  relevanceContextItemsToSolrFormula,
  buildSolrQuery,
  RelevanceContextItemTypes,
  withScore,
};
