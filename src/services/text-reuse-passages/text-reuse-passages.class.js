const debug = require('debug')('impresso/services/text-reuse-passages')
const { filtersToQueryAndVariables } = require('../../util/solr')
const TextReusePassage = require('../../models/text-reuse-passages.model')
const { NotFound } = require('@feathersjs/errors')
const Newspaper = require('../../models/newspapers.model')

class TextReusePassages {
  constructor (app) {
    this.solr = app.get('cachedSolr')
  }

  async find (params) {
    // retrieve all fields
    const fl = '*' // Object.values(TextReuseCluster.SolrFields).join(',')
    const filters = params.query.filters
    const { query } = filtersToQueryAndVariables(
      filters,
      this.solr.namespaces.TextReusePassages,
      {
        q: '*:*',
      }
    )

    debug('find q:', query, this.solr.namespaces.TextReusePassages)

    return this.solr
      .get(
        {
          q: query,
          fl,
          rows: params.query.limit,
          start: params.query.skip,
        },
        this.solr.namespaces.TextReusePassages
      )
      .then(({ responseHeader, response }) => {
        return {
          total: response.numFound, // "<total number of records>",
          limit: params.query.limit, // "<max number of items per page>",
          skip: params.query.skip, // "<number of skipped items (offset)>",
          data: response.docs.map((doc) => {
            const result = TextReusePassage.CreateFromSolr()(doc)
            if (params.query.addons.newspaper) {
              result.newspaper = Newspaper.getCached(result.newspaper.id)
              result.newspaper.id = result.newspaper.uid
            }
            return result
          }),
          // org: response.docs,
          info: {
            responseTime: {
              solr: responseHeader.QTime,
            },
            addons: params.query.addons,
          },
        }
      })
  }

  async get (ids = [], { query = {} }) {
    // for each id in ids, return the corresponding textReusePassages instance.
    const textReusePassages = await this.solr
      .get(
        {
          q: ids
            .map(
              (d) =>
                `${TextReusePassage.SolrFields.id}:${d.split(':').join('\\:')}`
            )
            .join(' OR '),
          hl: false,
          rows: ids.length,
          // all of them
          fl: Object.values(TextReusePassage.SolrFields).join(','),
        },
        this.solr.namespaces.TextReusePassages
      )
      .then(({ response }) =>
        response.numFound
          ? response.docs.map((doc) => TextReusePassage.CreateFromSolr()(doc))
          : []
      )
    debug('textReusePassages:', textReusePassages)
    if (!textReusePassages.length) {
      return NotFound()
    }
    if (ids.length === 1) {
      return textReusePassages[0]
    }
    return textReusePassages
  }
}

module.exports = TextReusePassages
