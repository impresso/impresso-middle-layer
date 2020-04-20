// @ts-check

/**
 * @typedef {import('.').RelevanceContextItem} RelevanceContextItem
 * @typedef {import('.').RelevanceContextItemType} RelevanceContextItemType
 * @typedef {import('.').TimeRangeContextParameters} TimeRangeContextParameters
 */

const RelevanceContextItemTypes = Object.freeze({
  TimeRange: /** @type {RelevanceContextItemType} */ ('timeRange'),
  Locations: /** @type {RelevanceContextItemType} */ ('locations'),
  Persons: /** @type {RelevanceContextItemType} */ ('persons'),
  Topics: /** @type {RelevanceContextItemType} */ ('topics'),
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
 *
 * @param {RelevanceContextItem} relevanceContextItem
 * @returns {string}
 */
function relevanceContextItemToSolrFormula({ type, parameters, weight }) {
  let parametersFormula = '1.0';

  if (type === RelevanceContextItemTypes.TimeRange) {
    parametersFormula = timeRangeFormula(/** @type {TimeRangeContextParameters} */ (parameters));
  }
  return `mul(${parametersFormula},${weight})`.replace(/[\s\n]/g, '');
}

module.exports = {
  relevanceContextItemToSolrFormula,
  RelevanceContextItemTypes,
};
