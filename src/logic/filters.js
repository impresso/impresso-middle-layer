// @ts-check
const moment = require('moment');

const DaterangeFilterValueRegex = /([^\s]+)\s+TO\s+([^\s]+)/;

function getTimedeltaInDaterangeFilterAsDays(daterangeFilter) {
  const value = Array.isArray(daterangeFilter.q) ? daterangeFilter.q[0] : daterangeFilter.q;
  const matches = DaterangeFilterValueRegex.exec(value);

  if (matches.length !== 3) return undefined;
  if (daterangeFilter.context === 'exclude') return undefined;

  const [fromDate, toDate] = matches.slice(1).map(v => moment.utc(v));
  return moment.duration(toDate.diff(fromDate)).as('days');
}

/**
 * Analyse filters and return the widest inclusive time interval in days.
 * @param {object[]} filters query filters
 * @return {number} time interval in days.
 */
function getWidestInclusiveTimeInterval(filters) {
  const daterangeFilters = filters.filter(({ type }) => type === 'daterange');
  const timedeltas = daterangeFilters
    .map(getTimedeltaInDaterangeFilterAsDays)
    .filter(v => v !== undefined)
    .sort();
  return timedeltas[0];
}

module.exports = {
  getWidestInclusiveTimeInterval,
};
