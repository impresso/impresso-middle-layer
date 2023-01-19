/**
 * solrDocMapping
 * @param {Object} fieldsToPropsMapper
 * @param {Klass} Klass
 * @returns
 */
const solrDocsMapCallbackFn = (fieldsToPropsMapper, Klass) => (doc) => {
  const mappedFields = Object.keys(doc).reduce((acc, key) => {
    if (!fieldsToPropsMapper[key]) {
      return acc
    }
    acc[fieldsToPropsMapper[key]] = doc[key]
    return acc
  }, {})
  const trc = new Klass(mappedFields)
  return trc
}

module.exports = { solrDocsMapCallbackFn }
