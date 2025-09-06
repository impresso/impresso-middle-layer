import { Bucket, SelectRequestBody, SimpleSolrClient, TermsFacetDetails } from '../internalServices/simpleSolr'
import { Topic, TopicWord } from '../models/generated/schemas'
import { SolrNamespaces } from '../solr'
import { logger } from '../logger'

import Graph from 'graphology'
import { circular } from 'graphology-layout'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import pagerank from 'graphology-metrics/centrality/pagerank'
import louvain from 'graphology-communities-louvain'
import hits from 'graphology-metrics/centrality/hits'

const TopicsLimit = 10 ** 6
const TopNTopics = 10
const LimitRelatedTopics = 300
const MinArticlesIncommon = 1
const MaxRelatedTopicsToKeep = 15
const RelatedThreshold = 0.1
const Threshold = 0.5

interface TopicIndexDocument {
  /** Topic model ID */
  id: string

  /** Language code */
  lg_s: string

  /** Topic model version */
  tp_model_s: string

  /** Topic number */
  tp_nb_i: number

  /** Word probabilities as pipe-separated string with probabilities */
  word_probs_dpf: string

  /** Topic suggestions as space-separated words */
  topic_suggest: string

  /** Solr document version */
  _version_: number
}

type TopicStub = Pick<Topic, 'uid' | 'language' | 'model' | 'words'>
type TopicStubWithCountItems = TopicStub & Pick<Topic, 'countItems'>
type TopicStubWithRelatedTopics = TopicStubWithCountItems &
  Pick<Topic, 'relatedTopics' | 'degree' | 'relatedTopicsStats'>

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

const topicIndexDocToTopicStub = (doc: TopicIndexDocument): TopicStub => ({
  uid: doc.id,
  language: doc.lg_s,
  model: doc.tp_model_s,
  words: dpfToWords(doc.word_probs_dpf).slice(0, TopNTopics),
})

const toTopicStubWithCountItems = (stub: TopicStub, counts: Record<string, number>): TopicStubWithCountItems => ({
  ...stub,
  countItems: counts[stub.uid] ?? 0,
})

const getHits = (graph: Graph): ReturnType<typeof hits> | { hubs: undefined; authorities: undefined } => {
  try {
    return hits(graph, { normalize: false })
  } catch (error) {
    logger.error('Error calculating HITS: %s', error)
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

export const prepareTopics = async (solrClient: SimpleSolrClient): Promise<Topic[]> => {
  const pageSize = 50
  let offset = 0
  let hasMorePages = true
  const topics = []
  while (hasMorePages) {
    logger.info('Getting %d topics with offset %d, %d topics already collected', pageSize, offset, topics.length)
    const topicsPage = await prepareTopicsPage(solrClient, offset, pageSize)
    topics.push(...topicsPage)
    offset += pageSize
    if (topicsPage.length < pageSize) {
      hasMorePages = false
    }
  }

  logger.info('Finished collecting topics. %d topics collected', topics.length)

  const fullTtopics = withGraphPositions(topics)
  logger.info('Added graph metrics')

  return fullTtopics
}

const prepareTopicsPage = async (solrClient: SimpleSolrClient, offset: number, pageSize: number): Promise<Topic[]> => {
  const topicsStubs = await getTopicsPage(solrClient, offset, pageSize)
  logger.info('Found %d topics', topicsStubs.length)

  const topicsStubsWithRelatedTopics = await withRelatedTopics(solrClient, topicsStubs)
  logger.info('Found weights and averages for related topics')

  return topicsStubsWithRelatedTopics as Topic[]
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
    throw new Error('Number of buckets does not match numBuckets')
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
  const relatedTopicsRequest = buildRequestFindRelatedTopics(topicStubs.map(t => t.uid))
  const relatedTopicsResponse = await solrClient.select<any, any, RelatedTopicBucket>(SolrNamespaces.Search, {
    body: relatedTopicsRequest,
  })

  const topicsStubsWithRelatedTopics = topicStubs.map(topicStub => {
    const facet = relatedTopicsResponse.facets?.[topicStub.uid] as any as RelatedTopicBucket

    return {
      ...topicStub,
      relatedTopics:
        facet?.relatedTopics?.buckets
          ?.filter(b => b.val !== topicStub.uid)
          .map(b => ({
            uid: b.val as string,
            w: 0, // this will be assigned in the next step
            avg: 0, // this will be assigned in the next step
          })) ?? [],
    } satisfies TopicStubWithCountItems & Pick<Topic, 'relatedTopics'>
  })

  logger.info(
    'Found %d related topics',
    topicsStubsWithRelatedTopics.map(t => t.relatedTopics.length).reduce((sum, i) => sum + i, 0)
  )

  const topicsGroupsIds = topicsStubsWithRelatedTopics.map(topic => ({
    topicId: topic.uid,
    relatedTopicsIds: topic.relatedTopics.map(rt => rt.uid),
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
            const { w, avg } = weightsAndAverages?.[topic.uid]?.[relatedTopic.uid] ?? { w: 0, avg: 0 }
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

const withGraphPositions = async (topics: TopicStubWithRelatedTopics[]): Promise<Topic[]> => {
  const graph = new Graph()

  graph.import(
    {
      attributes: {
        name: 'the awesome topic graph',
      },
      nodes: Object.values(topics).map(topic => ({
        key: topic.uid,
        attributes: {
          x: 0,
          y: 0,
          weight: topic.countItems,
        },
      })),
      edges: Object.values(topics)
        .map(
          topic =>
            topic.relatedTopics?.map(rel => ({
              source: topic.uid,
              target: rel.uid,
              attributes: {
                weight: rel.w,
              },
            })) ?? []
        )
        .reduce((acc, d) => acc.concat(d), []),
    },
    true
  )

  const { x, y } = graph.getNodeAttributes(graph.nodes()[1])
  if (!x && !y) {
    logger.info('No initial xy, do circular layout first.')
    circular.assign(graph)
  }

  const positions = forceAtlas2(graph, {
    iterations: 100,
    settings: {
      gravity: 20,
      linLogMode: false,
    },
  })

  const pageranks = pagerank(graph, { alpha: 0.9, getEdgeWeight: 1 })
  const communities = louvain(graph)

  const { hubs = undefined, authorities = undefined } = getHits(graph)

  return topics.map(
    topic =>
      ({
        ...topic,
        x: positions[topic.uid].x,
        y: positions[topic.uid].y,
        pagerank: pageranks[topic.uid],
        community: communities[topic.uid],
        hub: hubs?.[topic.uid],
        authority: authorities?.[topic.uid],
      }) satisfies Topic
  )
}
