const TimeDomain = 'time'

const StatsToSolrFunction = {
  stddev: field => `stddev(${field})`,
  mean: field => `avg(${field})`,
  min: field => `min(${field})`,
  max: field => `max(${field})`,
  p99_7: field => `percentile(${field}, 99.7)`,
  p50: field => `percentile(${field}, 50)`,
  p68: field => `percentile(${field}, 68)`,
}

const StatsToSolrStatistics = {
  stddev: 'stddev=true',
  min: 'min=true',
  max: 'max=true',
  mean: 'mean=true',
  p99_7: 'percentiles="99.7"',
  p50: 'percentiles="50"',
  p68: 'percentiles="68"',
}

const SupportedStats = Object.freeze(Object.keys(StatsToSolrFunction))
const SupportedStatistics = Object.freeze(Object.keys(StatsToSolrStatistics))
const DefaultStats = ['stddev', 'min', 'max', 'mean', 'p99_7']

export { TimeDomain, StatsToSolrFunction, StatsToSolrStatistics, SupportedStats, SupportedStatistics, DefaultStats }
