
const TimeDomain = 'time';

const StatsToSolrFunction = {
  stddev: field => `stddev(${field})`,
  mean: field => `avg(${field})`,
  min: field => `min(${field})`,
  max: field => `max(${field})`,
  p99_7: field => `percentile(${field}, 99.7)`,
  p50: field => `percentile(${field}, 50)`,
  p68: field => `percentile(${field}, 68)`,
};

const SupportedStats = Object.freeze(Object.keys(StatsToSolrFunction));
const DefaultStats = ['stddev', 'min', 'max', 'mean', 'p99_7'];

module.exports = {
  TimeDomain,
  StatsToSolrFunction,
  SupportedStats,
  DefaultStats,
};
