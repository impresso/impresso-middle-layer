import { NotFound } from '@feathersjs/errors'
import { getLogger } from '@/logger.js'
import type { Id, Params } from '@feathersjs/feathers'
import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import type { Filter } from '@/models/index.js'
import { FindResponse } from '@/models/common.js'
import { InternalTopic } from '@/models/generated/deprecated/models.js'
import type { Topic as SolrTopic } from '@/models/generated/external/solr.js'
import TopicModel, { SOLR_FL } from '@/models/topics.model.js'
import { SolrNamespaces } from '@/solr.js'
import type { ImpressoApplication } from '@/types.js'
import { measureTime } from '@/util/instruments.js'
import { asFindAll, asGet } from '@/util/solr/adapters.js'
import { escapeValue } from '@/util/solr/filterReducers.js'
import { BucketValue } from '@/internalServices/simpleSolr.js'

const logger = getLogger(['impresso', 'services', 'topics'])

export interface FindQuery {
  q?: string
  limit?: number
  offset?: number
  order_by?: string
}

export interface SanitizedParams {
  q?: string
  filters: Filter[]
  sq?: string
  sv?: string
}

export class Service {
  name: string
  app: ImpressoApplication

  constructor({ app = null, name = '' }: { app?: ImpressoApplication | null; name?: string } = {}) {
    this.name = String(name)
    this.app = app!
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async find(
    params: Params<FindQuery> & { sanitized: SanitizedParams; query: { limit: number; offset: number } }
  ): Promise<FindResponse<InternalTopic>> {
    // if there's a q, get all suggested topics matching q in their words (they are 300 max)
    const topics: Record<string, { order: number; matches?: string[] }> = {}
    // fill topics dict with results
    if (params.sanitized.q && params.sanitized.q.length > 2) {
      const q = escapeValue(params.sanitized.q).split(/\s/).join(' OR ')

      const request = {
        q: `topic_suggest:${q}`,
        highlight_by: 'topic_suggest',
        order_by: params.query.order_by,
        namespace: 'topics',
        limit: params.query.limit,
        offset: params.query.offset,
      }
      // const solrSuggestResponse = await measureTime(
      //   () => this.app.get('solrClient').findAll(request),
      //   'topics.find.solr.topics_suggest'
      // )
      const solrSuggestResponse = await asFindAll<{}, string, string, SolrTopic>(this.solr, 'topics', request)

      logger.debug(`[find] params.sanitized.q: ${params.sanitized} load topic uids...`)
      // no ids? return empty stuff
      if (!solrSuggestResponse?.response?.numFound) {
        return {
          data: [],
          total: 0,
          limit: params.query.limit,
          offset: params.query.offset,
          info: {
            filters: params.sanitized.filters,
          },
        }
      }

      if (!params.sanitized.filters.length) {
        const resolvers = buildResolvers(this.app)
        const collectedTopics = await Promise.all(
          solrSuggestResponse.response.docs.map(async d => {
            const doc = d as SolrTopic
            const t = await resolvers.topic(doc.id)
            if (!t) return undefined

            const topicResult = { ...t, uid: t?.id ?? '' } as InternalTopic
            if (t?.id && solrSuggestResponse.highlighting?.[t.id]?.topic_suggest) {
              topicResult.matches = solrSuggestResponse.highlighting[t.id].topic_suggest
            }
            return topicResult
          })
        )

        return {
          total: solrSuggestResponse.response.numFound,
          data: collectedTopics.filter(t => t !== undefined),
          limit: params.query.limit,
          offset: params.query.offset,
          info: {
            filters: params.sanitized.filters,
          },
        }
      }

      // otherwise, fill topic index
      solrSuggestResponse.response.docs.forEach((d, i) => {
        const doc = d as SolrTopic
        topics[doc.id] = {
          order: i,
          matches: solrSuggestResponse.highlighting?.[doc.id]?.topic_suggest,
        }
      })
    }

    const uids = Object.keys(topics)
    const solrQueryParts: string[] = []

    if (uids.length) {
      solrQueryParts.push(['(', uids.map(d => `topics_dpfs:${d}`).join(' OR '), ')'].join(''))
    }
    if (params.sanitized.filters.length) {
      solrQueryParts.push(`(${params.sanitized.sq})`)
    }
    if (!solrQueryParts.length) {
      solrQueryParts.push('*:*')
    }

    logger.debug(`[find] params.sanitized: ${params.sanitized} - topic uids: ${uids.length}`)

    const request = {
      q: solrQueryParts.join(' AND '),
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: params.query.limit,
          offset: params.query.offset,
          numBuckets: true,
        },
      }),
      limit: 0,
      offset: 0,
      fl: 'id',
      ...(params.sanitized.sv ? { vars: params.sanitized.sv as unknown as Record<string, string> } : {}),
    }
    // console.log(topics);
    // const solrResponse = await measureTime(
    //   () => this.app.get('solrClient').findAllPost(request),
    //   'topics.find.solr.posts'
    // )
    const solrResponse = await asFindAll(this.solr, SolrNamespaces.Search, request)

    logger.debug(`[find] solrResponse total document matching: ${solrResponse?.response?.numFound}`)
    const topicFacet = solrResponse.facets?.topic as { numBuckets?: number; buckets?: any[] } | undefined
    if (!solrResponse?.response?.numFound || !topicFacet) {
      logger.debug('[find] warning, no topic buckets found.')
      return {
        data: [],
        limit: params.query.limit,
        offset: params.query.offset,
        total: 0,
        info: {
          QTime: solrResponse.responseHeaders?.QTime ?? 0,
          filters: params.sanitized.filters,
        },
      }
    }

    let total = topicFacet.numBuckets ?? 0
    let buckets = topicFacet.buckets ?? []

    if (uids.length) {
      logger.debug(`[find] filtering out facets, initial total approx: ${topicFacet.numBuckets}`)
      // filter out facets based on their uid.
      buckets = buckets.filter(d => {
        const val = typeof d === 'object' && d !== null && 'value' in d ? d.value : d
        return uids.includes(String(val))
      })
      logger.debug(`[find] new total:  ${buckets.length}`)
      total = buckets.length
      // get only the portion we need.
      buckets = buckets.slice(params.query.offset, params.query.offset + params.query.limit)
    }

    const resolvers = buildResolvers(this.app)
    // remap data
    const data = await Promise.all(
      buckets.map(async d => {
        const bucket = typeof d === 'object' && d !== null && 'val' in d ? d : { val: d, count: 0 }
        const topic = await resolvers.topic(String(bucket.val))
        if (topic == null) return

        const { id: topicId, ...topicOther } = topic
        const internalTopic: InternalTopic = { id: topicId, ...topicOther } satisfies InternalTopic
        if (uids.length && topics[String(bucket.val)]) {
          internalTopic.matches = topics[String(bucket.val)].matches
        }
        internalTopic.contentItemsCount = typeof bucket.count === 'number' ? bucket.count : 0
        return internalTopic
      })
    )

    return {
      total,
      data: data.filter(d => d != null),
      limit: params.query.limit,
      offset: params.query.offset,
      info: {
        QTime: solrResponse.responseHeaders?.QTime ?? 0,
        filters: params.sanitized.filters,
      },
    }
  }

  async get(id: Id, params?: Params): Promise<InternalTopic> {
    const resolvers = buildResolvers(this.app)

    return measureTime(
      () =>
        asGet(this.solr, SolrNamespaces.Topics, String(id), { fl: SOLR_FL, ...params }, TopicModel.solrFactory).then(
          async topic => {
            if (!topic) {
              throw new NotFound(`Topic with id ${id} not found`)
            }
            const { id: topicId, ...topicBody } = topic

            const cached = await resolvers.topic(String(id))
            if (cached) {
              if (cached.contentItemsCount !== undefined) {
                return {
                  id: topicId,
                  ...topicBody,
                  contentItemsCount: cached.contentItemsCount,
                } satisfies InternalTopic
              }
              if ((cached as any).relatedTopics !== undefined) {
                return {
                  id: topicId,
                  ...topicBody,
                  relatedTopics: (cached as any).relatedTopics,
                } satisfies InternalTopic
              }
            }
            return { id: topicId, ...topicBody } satisfies InternalTopic
          }
        ),
      'topics.get.solr.topics'
    )
  }
}

export default function (options?: { app?: ImpressoApplication | null; name?: string }) {
  return new Service(options)
}
