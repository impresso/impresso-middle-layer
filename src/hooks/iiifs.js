const { get, keyBy, assign, flatten } = require('lodash')
const debug = require('debug')('impresso/hooks/iiif')

/**
 *
 * @param {*} service
 * @param {*} method
 */
const getIIIf = pagesPath => async context => {
  if (!context.params.query.addons.iiif) {
    return context
  }
  // context.result.reduce(reducer, [])
  if (Array.isArray(context.result.data)) {
    const collectedPageIds = flatten(context.result.data.map(result => get(result, pagesPath, []).map(d => d.id)))
    debug('getIIIf for', collectedPageIds)
    const pages = await context.app.service('/pages').get(collectedPageIds)
    const pagesIndex = keyBy(pages, 'id')
    // for every pagespath
    context.result.data = context.result.data.map(result => {
      const resultPages = get(result, pagesPath)
      if (Array.isArray(resultPages)) {
        assign(
          result.pages,
          resultPages.map(p => {
            if (pagesIndex[p.id]) {
              return pagesIndex[p.id]
            } else {
              return p
            }
          })
        )
      }
      return result
    })
  }
  return context
}

module.exports = { getIIIf }
