import { Bucket, SelectRequestBody, SimpleSolrClient, TermsFacetDetails } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import { logger } from '@/logger.js'
import { uniqBy } from 'lodash-es'

import { MultiGraph as Graph } from 'graphology'
import { circular } from 'graphology-layout'
import { default as forceAtlas2 } from 'graphology-layout-forceatlas2'
import { default as louvain } from 'graphology-communities-louvain'
import { hits, pagerank } from 'graphology-metrics/centrality/index.js'
import type { CachedTopic } from '@/models/generated/app/cache.js'
import type { TopicWord } from '@/models/generated/app/entities.js'
import type { Topic as SolrTopic } from '@/models/consolidated/solr/index.js'
import { topicLabelFieldsFromSolr, TopicLabelFields } from '@/models/topics.model.js'

const TopicsLimit = 10 ** 6
const TopNTopics = 10
const LimitRelatedTopics = 300
const MinArticlesIncommon = 1
const MaxRelatedTopicsToKeep = 15
const RelatedThreshold = 0.1
const Threshold = 0.5

type TopicIndexDocument = Pick<
  SolrTopic,
  | 'id'
  | 'lg_s'
  | 'tp_model_s'
  | 'tp_nb_i'
  | 'word_probs_dpf'
  | 'topic_suggest'
  | 'tp_desc_s'
  | 'tp_meta_s'
  | 'topic_type_s'
  | 'label_short_s'
  | 'label_long_txt_en'
  | 'confidence_s'
  | 'representative_terms_ss'
  | 'generated_by_s'
> & {
  /** Solr document version */
  _version_: number
}

type TopicStub = Pick<CachedTopic, 'id' | 'language' | 'model' | 'words'> & TopicLabelFields
type TopicStubWithCountItems = TopicStub & Pick<CachedTopic, 'contentItemsCount'>
type TopicStubWithRelatedTopics = TopicStubWithCountItems &
  Pick<CachedTopic, 'relatedTopics' | 'degree' | 'relatedTopicsStats'>

type RelatedTopicBucket = Bucket & {
  relatedTopics: {
    numBuckets: number
    buckets: Bucket[]
  }
}

type RelatedTopicAvgWeightBucket = Bucket & {
  [relatedTopicId: string]: Bucket & {
    avgCombinedTopicWeight?: number
  }
}

const dpfToWords = (dpf: string): TopicWord[] => {
  return dpf
    .split(' ')
    .map(pair => pair.split('|'))
    .map(([word, prob]) => ({ w: word, p: parseFloat(prob) }))
}

export const topicIndexDocToTopicStub = (doc: TopicIndexDocument): TopicStub => {
  const words = dpfToWords(doc.word_probs_dpf).slice(0, TopNTopics)
  const label =
    doc.label_short_s ??
    words
      .slice(0, 5)
      .map(w => w.w)
      .join(' ')
  return {
    id: doc.id,
    language: doc.lg_s,
    model: doc.tp_model_s,

    words,
    ...topicLabelFieldsFromSolr(doc),
    label,
  }
}

const toTopicStubWithCountItems = (stub: TopicStub, counts: Record<string, number>): TopicStubWithCountItems => ({
  ...stub,
  contentItemsCount: counts[stub.id] ?? 0,
})

const getHits = (graph: Graph): ReturnType<typeof hits> | { hubs: undefined; authorities: undefined } => {
  try {
    return hits(graph, { normalize: false })
  } catch (error) {
    logger.warn(`Error calculating HITS: ${(error as Error).message}`)
    return { hubs: undefined, authorities: undefined }
  }
}

const requestTopicsCounts: SelectRequestBody = {
  query: '*:*',
  limit: 0,
  offset: 0,
  facet: {
    topics: {
      type: 'terms',
      field: 'topics_dpfs',
      mincount: 1,
      numBuckets: true,
      limit: TopicsLimit,
    },
  },
}

const buildRequestGetTopics = (offset: number, pageSize: number): SelectRequestBody => ({
  query: '*:*',
  limit: pageSize,
  offset,
})

const buildRequestFindRelatedTopics = (
  topicsIds: string[],
  lowerRelevanceThreshold: number = Threshold
): SelectRequestBody => ({
  query: '*:*',
  limit: 0,
  offset: 0,
  facet: topicsIds.reduce((acc, topicId) => {
    return {
      ...acc,
      [topicId]: {
        type: 'query',
        query: `{!frange l=${lowerRelevanceThreshold}}payload(topics_dpfs,${topicId})`,
        facet: {
          relatedTopics: {
            type: 'terms',
            field: 'topics_dpfs',
            mincount: MinArticlesIncommon,
            limit: LimitRelatedTopics,
            numBuckets: true,
          },
        },
      },
    }
  }, {}),
})

const buildRequestFindRelatedTopicsAverageWeight = (
  topicsGroupsIds: { topicId: string; relatedTopicsIds: string[] }[],
  lowerRelevanceThreshold: number = Threshold,
  lowerRelevanceRelatedThreshold: number = RelatedThreshold
): SelectRequestBody => ({
  query: '*:*',
  limit: 0,
  offset: 0,
  facet: topicsGroupsIds.reduce((acc, { topicId, relatedTopicsIds }) => {
    return {
      ...acc,
      [topicId]: {
        type: 'query',
        query: `{!frange l=${lowerRelevanceThreshold}}payload(topics_dpfs,${topicId})`,
        facet: relatedTopicsIds.reduce(
          (acc, relatedTopicId) => ({
            ...acc,
            [relatedTopicId]: {
              type: 'query',
              query: `{!frange l=${lowerRelevanceRelatedThreshold}}payload(topics_dpfs,${relatedTopicId})`,
              facet: {
                avgCombinedTopicWeight: `avg(sum(payload(topics_dpfs,${topicId}),payload(topics_dpfs,${relatedTopicId})))`,
              },
            },
          }),
          {}
        ),
      },
    }
  }, {}),
})

export const prepareTopics = async (solrClient: SimpleSolrClient): Promise<CachedTopic[]> => {
  const pageSize = 50
  let offset = 0
  let hasMorePages = true
  const topics = []
  while (hasMorePages) {
    logger.info(`Getting ${pageSize} topics with offset ${offset}, ${topics.length} topics already collected`)
    const topicsPage = await prepareTopicsPage(solrClient, offset, pageSize)
    topics.push(...topicsPage)
    offset += pageSize
    if (topicsPage.length < pageSize) {
      hasMorePages = false
    }
  }

  logger.info(`Finished collecting topics. ${topics.length} topics collected`)

  const fullTtopics = withGraphPositions(topics)
  logger.info('Added graph metrics')

  return fullTtopics
}

const prepareTopicsPage = async (
  solrClient: SimpleSolrClient,
  offset: number,
  pageSize: number
): Promise<CachedTopic[]> => {
  const topicsStubs = await getTopicsPage(solrClient, offset, pageSize)
  logger.info(`Found ${topicsStubs.length} topics`)

  const topicsStubsWithRelatedTopics = await withRelatedTopics(solrClient, topicsStubs)
  logger.info('Found weights and averages for related topics')

  return topicsStubsWithRelatedTopics
}

const getTopicsPage = async (
  solrClient: SimpleSolrClient,
  offset: number,
  pageSize: number
): Promise<TopicStubWithCountItems[]> => {
  const [topicsDocsResponse, topicsCountsResponse] = await Promise.all([
    solrClient.select<TopicIndexDocument>(SolrNamespaces.Topics, {
      body: buildRequestGetTopics(offset, pageSize),
    }),
    solrClient.select<any, 'topics'>(SolrNamespaces.Search, {
      body: requestTopicsCounts,
    }),
  ])
  const { buckets, numBuckets } = (topicsCountsResponse.facets?.topics as TermsFacetDetails) ?? {
    buckets: [],
    numBuckets: 0,
  }
  if (buckets.length !== numBuckets) {
    throw new Error(`Number of buckets (${buckets.length}) does not match numBuckets (${numBuckets})`)
  }

  const topicsCounts =
    topicsCountsResponse.facets?.topics?.buckets?.reduce<Record<string, number>>(
      (counts, bucket) => ({ ...counts, [bucket.val! as string]: bucket.count! }),
      {}
    ) ?? {}

  const topicStubs =
    topicsDocsResponse.response?.docs?.map(doc => {
      return toTopicStubWithCountItems(topicIndexDocToTopicStub(doc), topicsCounts)
    }) ?? []

  return topicStubs
}

const withRelatedTopics = async (
  solrClient: SimpleSolrClient,
  topicStubs: TopicStubWithCountItems[]
): Promise<TopicStubWithRelatedTopics[]> => {
  const relatedTopicsRequest = buildRequestFindRelatedTopics(topicStubs.map(t => t.id))
  const relatedTopicsResponse = await solrClient.select<any, any, RelatedTopicBucket>(SolrNamespaces.Search, {
    body: relatedTopicsRequest,
  })

  const topicsStubsWithRelatedTopics = topicStubs.map(topicStub => {
    const facet = relatedTopicsResponse.facets?.[topicStub.id] as any as RelatedTopicBucket

    return {
      ...topicStub,
      relatedTopics:
        facet?.relatedTopics?.buckets
          ?.filter(b => b.value !== topicStub.id)
          .map(b => ({
            id: b.value as string,
            w: 0, // this will be assigned in the next step
            avg: 0, // this will be assigned in the next step
          })) ?? [],
    } satisfies TopicStubWithCountItems & Pick<CachedTopic, 'relatedTopics'>
  })

  logger.info(
    `Found ${topicsStubsWithRelatedTopics.map(t => t.relatedTopics.length).reduce((sum, i) => sum + i, 0)} related topics`
  )

  const topicsGroupsIds = topicsStubsWithRelatedTopics.map(topic => ({
    topicId: topic.id,
    relatedTopicsIds: topic.relatedTopics.map(rt => rt.id),
  }))
  const relatedTopicsAvgWeightsRequest = buildRequestFindRelatedTopicsAverageWeight(topicsGroupsIds)
  const relatedTopicsAvgWeightsResponse = await solrClient.select<any, any, RelatedTopicAvgWeightBucket>(
    SolrNamespaces.Search,
    {
      body: relatedTopicsAvgWeightsRequest,
    }
  )

  const weightsAndAverages = Object.keys(relatedTopicsAvgWeightsResponse.facets ?? {}).reduce(
    (acc, topicId) => {
      const facet: RelatedTopicAvgWeightBucket = relatedTopicsAvgWeightsResponse.facets![topicId] as any
      if (typeof facet !== 'object') return acc
      acc[topicId] = Object.keys(facet).reduce(
        (acc, relatedTopicId) => ({
          ...acc,
          [relatedTopicId]: {
            w: facet[relatedTopicId].count ?? 0,
            avg: facet[relatedTopicId].avgCombinedTopicWeight ?? 0,
          },
        }),
        {}
      )
      return acc
    },
    {} as Record<string, Record<string, { w: number; avg: number }>>
  )

  return topicsStubsWithRelatedTopics.map(
    topic =>
      ({
        ...topic,
        degree: topic.relatedTopics.length,
        relatedTopics: topic.relatedTopics
          .map(relatedTopic => {
            const { w, avg } = weightsAndAverages?.[topic.id]?.[relatedTopic.id] ?? { w: 0, avg: 0 }
            return { ...relatedTopic, w, avg }
          })
          .sort((a, b) => b.w * b.avg - a.w * a.avg)
          .slice(0, MaxRelatedTopicsToKeep),
        relatedTopicsStats: {
          MaxRelatedTopicsToKeep,
          MinArticlesIncommon,
          RelatedThreshold,
          Threshold,
        },
      }) satisfies TopicStubWithRelatedTopics
  )
}

const withGraphPositions = async (topics: TopicStubWithRelatedTopics[]): Promise<CachedTopic[]> => {
  const graph = new Graph()

  const nodes = uniqBy(
    Object.values(topics).map(topic => ({
      key: topic.id,
      attributes: {
        name: 'the awesome topic graph',
      },
    })),
    n => n.key
  )
  const nodeIds = new Set(nodes.map(n => n.key))

  const edges = uniqBy(
    Object.values(topics)
      .map(
        topic =>
          topic.relatedTopics?.map(rel => ({
            source: topic.id,
            target: rel.id,
            attributes: {
              weight: rel.w,
            },
          })) ?? []
      )
      .reduce((acc, d) => acc.concat(d), [])
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)),
    e => `${e.source}|${e.target}` // make sure pairs are unique
  )

  graph.import({
    attributes: {
      name: 'the awesome topic graph',
    },
    nodes,
    edges,
  })

  const { x, y } = graph.getNodeAttributes(graph.nodes()[1])
  if (!x && !y) {
    logger.info('No initial xy, do circular layout first.')
    circular.assign(graph)
  }

  // @ts-ignore
  const positions = forceAtlas2(graph, {
    iterations: 100,
    settings: {
      gravity: 20,
      linLogMode: false,
    },
  })

  const pageranks = pagerank(graph, { alpha: 0.9, getEdgeWeight: 1 })
  let communities: Record<string, number> = {}
  try {
    // @ts-ignore
    communities = louvain(graph)
  } catch (error) {
    console.warn('Error computing communities:', (error as Error).message)
  }

  const { hubs = undefined, authorities = undefined } = getHits(graph)

  return topics.map(
    topic =>
      ({
        ...topic,
        x: positions[topic.id].x,
        y: positions[topic.id].y,
        pagerank: pageranks[topic.id],
        community: communities[topic.id],
        hub: hubs?.[topic.id],
        authority: authorities?.[topic.id],
      }) satisfies CachedTopic
  )
}
