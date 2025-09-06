import { optionalMediaSourceToNewspaper } from '../newspapers/newspapers.class'
import TextReusePassage, { SolrFields } from '../../models/text-reuse-passages.model'
import Debug from 'debug'
import { filtersToQueryAndVariables } from '../../util/solr'
import { NotFound } from '@feathersjs/errors'
import { parseOrderBy } from '../../util/queryParameters'

const debug = Debug('impresso/services/text-reuse-passages')

export const OrderByKeyToField = {
  clusterSize: SolrFields.clusterSize,
  lexicalOverlap: SolrFields.lexicalOverlap,
  timeDifferenceDay: SolrFields.timeDifferenceDay,
  size: SolrFields.size,
  date: SolrFields.date,
}

export const GroupByValues = ['textReuseClusterId']

export class TextReusePassages {
  constructor(app) {
    this.solr = app.service('simpleSolrClient')
    this.app = app
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

    const fq = `{!collapse field=${SolrFields[params.query.group_by]} max=ms(${SolrFields.date})}`
    const groupby = params.query.group_by ? { filter: fq } : null

    debug(
      'find q:',
      query,
      '- index:',
      this.solr.namespaces.TextReusePassages,
      '- groupby:',
      groupby
      // params.query
    )

    const mediaSourcesLookup = await this.app.service('media-sources').getLookup()

    return this.solr
      .select(this.solr.namespaces.TextReusePassages, {
        body: {
          query,
          fields: fl,
          limit: params.query.limit,
          offset: params.query.offset,
          sort,
          ...groupby,
        },
      })
      .then(({ responseHeader, response }) => {
        return {
          data: response.docs.map(doc => {
            const result = TextReusePassage.fromSolr(doc)
            if (params.query?.addons?.newspaper && result.newspaper != null) {
              result.newspaper = optionalMediaSourceToNewspaper(mediaSourcesLookup[result.newspaper.id])
              if (result.newspaper != null) {
                result.newspaper.id = result.newspaper.uid
              }
            }
            return result
          }),
          total: response.numFound, // "<total number of records>",
          limit: params.query.limit ?? 10, // "<max number of items per page>",
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
    const textReusePassage = await this.solr
      .selectOne(this.solr.namespaces.TextReusePassages, {
        body: {
          query: [id].map(d => `${SolrFields.id}:${d.split(':').join('\\:')}`).join(' OR '),
          params: {
            hl: false,
          },
          limit: 1,
          // all of them
          fields: Object.values(SolrFields).join(','),
        },
      })
      .then(doc => (doc != null ? TextReusePassage.fromSolr(doc) : undefined))
    debug('textReusePassages:', textReusePassage)
    if (textReusePassage == null) return new NotFound(id)
    return textReusePassage
  }
}
