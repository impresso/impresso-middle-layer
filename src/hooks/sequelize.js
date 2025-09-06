const lodash = require('lodash');
const debug = require('debug')('impresso/hooks:sequelize');
const verbose = require('debug')('verbose:impresso/hooks:sequelize');
const { Op } = require('sequelize');
/**
 * reduceFiltersToSequelizeQuery
 * From standard Filter to sequelize where objects.
 *
 * @param  {[type]} name         group name
 * @param  {Array}  [filters=[]] group of filters
 * @return {Array}              Array of sequelize `where` objects
 */
const reduceFiltersToSequelizeQuery = (name, filters = []) => {
  verbose(`'reduceFiltersToSequelizeQuery' treating group: ${name}, ${filters.length} elements`);
  if (name === 'entity') {
    return {
      [Op.and]: filters.reduce((acc, filter) => {
        acc.push({
          entityId: filter.q,
        });
        return acc;
      }, []),
    };
  }
  return null;
};

const filtersToSequelizeQuery = () => async (context) => {
  if (context.type !== 'before') {
    throw new Error('The \'filtersToSequelizeQuery\' hook should only be used as a \'before\' hook.');
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('The \'filtersToSequelizeQuery\' hook should be used after a \'validate\' hook.');
  }
  // go out
  if (!Array.isArray(context.params.sanitized.filters)) {
    debug('\'filtersToSequelizeQuery\': no filters found in params.query, skip hook.');
    return;
  }

  const groups = lodash.groupBy(context.params.sanitized.filters, 'type');
  const types = Object.keys(groups);
  const results = [];
  debug('\'filtersToSequelizeQuery\' types found in filters:', types);

  // group filters by type, then concat with [Op.and]
  types.forEach((i) => {
    const reducedFilter = reduceFiltersToSequelizeQuery(i, groups[i]);
    if (reducedFilter) {
      results.push(reducedFilter);
    }
  });
  context.params.sanitized.sequelizeQuery = results;
};

export default {
  filtersToSequelizeQuery,
};
