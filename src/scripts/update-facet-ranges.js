const fs = require('fs')
const config = require('@feathersjs/configuration')()()

const solrClient = require('../solr').client(config.solr, config.solrConnectionPool)

const { SolrMappings } = require('../data/constants')

async function getFacetsRanges(index) {
  const facetQueryPart = Object.entries(SolrMappings[index].facets)
    .filter(([, { type }]) => type === 'range')
    .reduce((acc, [facet, descriptor]) => {
      acc[`${facet}__min`] = `min(${descriptor.field})`
      acc[`${facet}__max`] = `max(${descriptor.field})`
      return acc
    }, {})
  const query = {
    'json.facet': JSON.stringify(facetQueryPart),
    rows: 0,
    q: '*:*',
    hl: false,
  }
  const { facets = {} } = await solrClient.requestGetRaw(query, index)

  return Object.entries(facets || {}).reduce((acc, [key, value]) => {
    if (key === 'count') return acc
    const [facetKey, field] = key.split('__')
    const nestedValue = acc[facetKey] || {}
    nestedValue[field] = value
    acc[facetKey] = nestedValue
    return acc
  }, {})
}

Promise.all(
  Object.keys(SolrMappings).map(async index => ({
    index,
    facets: await getFacetsRanges(index),
  }))
)
  .then(items => {
    const itemsMap = items.reduce((acc, { index, facets }) => {
      acc[index] = facets
      return acc
    }, {})

    const fileName = './data/facetRanges.json'
    fs.writeFileSync(fileName, JSON.stringify(itemsMap))
  })
  .then(() => {
    console.info('Done')
    process.exit(0)
  })
  .catch(error => {
    console.error(error.message)
    process.exit(1)
  })
