const assert = require('assert');
const { uniq, includes } = require('lodash');

const { filtersToSolr, NON_FILTERED_FIELDS } = require('../hooks/search');

/**
 * Return a section of the Solr query based on the filters **of the same type**.
 * @param {array} filters a list of filters (`src/schema/search/filter.json`).
 * @return {string} a Solr query.
 */
function filtersToQuery(filters) {
  const filtersTypes = uniq(filters.map(f => f.type));
  assert.equal(filtersTypes.length, 1, `Filters must be of the same type but they are of: ${filtersTypes.join(', ')}`);

  const type = filtersTypes[0];
  const statement = filtersToSolr(type, filters);

  return includes(NON_FILTERED_FIELDS, type)
    ? statement
    : `filter(${statement})`;
}


module.exports = {
  filtersToQuery,
};
