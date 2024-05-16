const debug = require('debug')('impresso/services/text-reuse-passages')
const { filtersToQueryAndVariables } = require('../../util/solr')
const TextReusePassage = require('../../models/text-reuse-passages.model')
const { NotFound } = require('@feathersjs/errors')
const Newspaper = require('../../models/newspapers.model')
const { parseOrderBy } = require('../../util/queryParameters')

export const OrderByKeyToField = {
  clusterSize: TextReusePassage.SolrFields.clusterSize,
  lexicalOverlap: TextReusePassage.SolrFields.lexicalOverlap,
  timeDifferenceDay: TextReusePassage.SolrFields.timeDifferenceDay,
  size: TextReusePassage.SolrFields.size,
  date: TextReusePassage.SolrFields.date,
}

export const GroupByValues = ['textReuseClusterId']

export class TextReusePassages {
  constructor(app) {
    this.solr = app.service('cachedSolr')
  }

  async find(params) {
    // retrieve all fields
    const fl = '*' // Object.values(TextReuseCluster.SolrFields).join(',')
    const filters = params.query.filters
    const [orderByField, orderByDescending] = parseOrderBy(params.query.order_by, OrderByKeyToField)
    const { query } = filtersToQueryAndVariables(filters, this.solr.namespaces.TextReusePassages, {
      q: '*:*',
    })
    const sort = orderByField ? `${orderByField} ${orderByDescending ? 'desc' : 'asc'}, id asc` : null

    const fq = `{!collapse field=${
      TextReusePassage.SolrFields[params.query.group_by]
    } max=ms(${TextReusePassage.SolrFields.date})}`
    const groupby = params.query.group_by ? { fq } : null

    debug(
      'find q:',
      query,
      '- index:',
      this.solr.namespaces.TextReusePassages,
      '- groupby:',
      groupby
      // params.query
    )

    return this.solr
      .get(
        {
          q: query,
          fl,
          rows: params.query.limit,
          start: params.query.offset,
          sort,
          ...groupby,
        },
        this.solr.namespaces.TextReusePassages
      )
      .then(({ responseHeader, response }) => {
        return {
          data: response.docs.map(doc => {
            const result = TextReusePassage.CreateFromSolr()(doc)
            if (params.query?.addons?.newspaper && result.newspaper != null) {
              result.newspaper = Newspaper.getCached(result.newspaper.id)
              result.newspaper.id = result.newspaper.uid
            }
            return result
          }),
          total: response.numFound, // "<total number of records>",
          limit: params.query.limit, // "<max number of items per page>",
          offset: params.query.offset ?? 0, // "<number of skipped items (offset)>",
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

  async get(id, { query = {} }) {
    // return the corresponding textReusePassages instance.
    const textReusePassages = await this.solr
      .get(
        {
          q: [id].map(d => `${TextReusePassage.SolrFields.id}:${d.split(':').join('\\:')}`).join(' OR '),
          hl: false,
          rows: 1,
          // all of them
          fl: Object.values(TextReusePassage.SolrFields).join(','),
        },
        this.solr.namespaces.TextReusePassages
      )
      .then(({ response }) =>
        response.numFound ? response.docs.map(doc => TextReusePassage.CreateFromSolr()(doc)) : []
      )
    debug('textReusePassages:', textReusePassages)
    if (!textReusePassages.length) {
      return new NotFound(id)
    }
    return textReusePassages[0]
  }
}
