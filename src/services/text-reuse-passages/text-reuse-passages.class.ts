import { NotFound } from '@feathersjs/errors'
import { getLogger } from '@/logger.js'
import { Params } from '@feathersjs/feathers'
import { Filter } from 'impresso-jscommons'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { AllDocumentFields } from '@/models/text-reuse-passage.js'
import TextReusePassage, { SolrFields } from '@/models/text-reuse-passages.model.js'
import { ImpressoApplication } from '@/types.js'
import { parseOrderBy } from '@/util/queryParameters.js'
import { filtersToQueryAndVariables } from '@/util/solr/index.js'

const logger = getLogger(['impresso', 'services', 'text-reuse-passages'])

export const OrderByKeyToField = {
  clusterSize: SolrFields.clusterSize,
  lexicalOverlap: SolrFields.lexicalOverlap,
  timeDifferenceDay: SolrFields.timeDifferenceDay,
  size: SolrFields.size,
  date: SolrFields.date,
}

export const GroupByValues = ['textReuseClusterId']

interface FindQuery {
  filters: Filter[]
  order_by?: keyof typeof OrderByKeyToField
  group_by?: keyof typeof SolrFields
  limit?: number
  offset?: number
}

interface FindParams extends Params<FindQuery> {}

export class TextReusePassages {
  private solr: SimpleSolrClient
  private app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.app = app
  }

  async find(params: FindParams) {
    // retrieve all fields
    const fl = '*' // Object.values(TextReuseCluster.SolrFields).join(',')
    const filters = params.query?.filters ?? []
    const [orderByField, orderByDescending] = parseOrderBy(params.query?.order_by, OrderByKeyToField)
    const { query, filter } = filtersToQueryAndVariables(
      filters,
      this.solr.namespaces.TextReusePassages,
      this.app.get('solrConfiguration').namespaces ?? [],
      this.app.get('features') ?? {}
    )
    const sort = orderByField ? `${orderByField} ${orderByDescending ? 'desc' : 'asc'}, id asc` : null
    const queryFilter = ([] as string[]).concat((filter ?? []) as string[])
    const fq = `{!collapse field=${params.query?.group_by ? SolrFields[params.query?.group_by] : ''} max=ms(${SolrFields.date})}`
    const effectiveFilter = params.query?.group_by ? queryFilter.concat(fq) : queryFilter

    logger.debug(`find q: ${query} - index: ${this.solr.namespaces.TextReusePassages} - groupby: ${params.query?.group_by}`)

    const mediaSourcesLookup = await this.app.service('media-sources').getLookup()

    return this.solr
      .select<AllDocumentFields>(this.solr.namespaces.TextReusePassages, {
        body: {
          query,
          filter: effectiveFilter,
          fields: fl,
          limit: params.query?.limit,
          offset: params.query?.offset,
          sort: sort ?? undefined,
        },
      })
      .then(({ response }) => {
        return {
          data: response?.docs.map(doc => {
            const result = TextReusePassage.fromSolr(doc)
            return result
          }),
          total: response?.numFound, // "<total number of records>",
          limit: params.query?.limit ?? 10, // "<max number of items per page>",
          offset: params.query?.offset ?? 0, // "<number of skipped items (offset)>",
          // org: response.docs,
        }
      })
  }

  async get(id: string) {
    // return the corresponding textReusePassages instance.
    const doc = await this.solr.selectOne<AllDocumentFields>(this.solr.namespaces.TextReusePassages, {
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
    const textReusePassage = doc != null ? TextReusePassage.fromSolr(doc) : undefined
    logger.debug(`textReusePassages: ${textReusePassage}`)
    if (textReusePassage == null) return new NotFound(id)
    return textReusePassage
  }
}
