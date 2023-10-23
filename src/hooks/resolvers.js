const lodash = require('lodash')
const debug = require('debug')('impresso/hooks/resolvers')
const Collection = require('../models/collections.model')

const resolveTextReuseClusters = () => async (context) => {
  if (context.path !== 'search-facets' || context.method !== 'get') {
    throw new Error(
      'resolveTextReuseClusters hook can only be used with search-facets service'
    )
  }
  const uids = context.result
    .filter((d) => d.type === 'textReuseCluster')
    .reduce((acc, d) => acc.concat(d.buckets.map((di) => di.val)), [])

  if (!uids.length) {
    return
  }
  debug('resolveTextReuseClusters uids:', uids)
  // get text reuse clusters as dictionary from text-reuse-clusters service
  const index = await context.app
    .service('text-reuse-passages')
    .find({
      query: {
        filters: [{ type: 'textReuseCluster', q: uids }],
        groupby: 'textReuseClusterId',
        limit: uids.length,
      },
    })
    .then(({ data }) => {
      debug('resolveTextReuseClusters data:', data.length)
      return lodash.keyBy(data, 'textReuseCluster.id')
    })
    .catch((err) => {
      console.error('hook resolveTextReuseClusters ERROR')
      console.error(err)
    })
  debug('resolveTextReuseClusters index keys:', Object.keys(index))
  context.result = context.result.map((d) => {
    if (d.type !== 'textReuseCluster') {
      return d
    }
    d.buckets = d.buckets.map((b) => {
      b.item = index[b.val]
      return b
    })
    return d
  })
}

const resolveCollections = () => async (context) => {
  let uids = []
  // collect the uids list based on the different service
  if (context.path === 'search-facets') {
    uids = context.result
      .filter((d) => d.type === 'collection')
      .reduce((acc, d) => acc.concat(d.buckets.map((di) => di.uid)), [])
  } else {
    throw new Error(
      'context path is not registered to be used with resolveCollections hook'
    )
  }

  if (!uids.length) {
    return
  }
  // get collections as dictionary
  const index = await Collection.sequelize(context.app.get('sequelizeClient'))
    .findAll({
      where: {
        uid: uids,
      },
    })
    .then((rows) =>
      lodash.keyBy(
        rows.map((r) => r.toJSON()),
        'uid'
      )
    )
    .catch((err) => {
      console.error('hook resolveCollections ERROR')
      console.error(err)
    })

  if (context.path === 'search-facets') {
    context.result = context.result.map((d) => {
      if (d.type !== 'collection') {
        return d
      }
      d.buckets = d.buckets.map((b) => {
        b.item = index[b.uid]
        return b
      })
      return d
    })
  }
}

module.exports = { resolveCollections, resolveTextReuseClusters }
