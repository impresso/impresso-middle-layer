import { SelectRequestBody, SimpleSolrClient, TermsFacetDetails } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import { logger } from '@/logger.js'

import type { CachedTopic } from '@/models/generated/app/cache.js'
import type { TopicWord } from '@/models/generated/app/entities.js'
import type { Topic as SolrTopic } from '@/models/consolidated/solr/index.js'
import { topicLabelFieldsFromSolr, TopicLabelFields } from '@/models/topics.model.js'

const TopicsLimit = 10 ** 6
const TopNTopics = 10

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

export const prepareTopics = async (solrClient: SimpleSolrClient): Promise<CachedTopic[]> => {
  const pageSize = 50
  let offset = 0
  let hasMorePages = true
  const topics: CachedTopic[] = []
  while (hasMorePages) {
    logger.info(`Getting ${pageSize} topics with offset ${offset}, ${topics.length} topics already collected`)
    const topicsPage = await getTopicsPage(solrClient, offset, pageSize)
    topics.push(...topicsPage)
    offset += pageSize
    if (topicsPage.length < pageSize) {
      hasMorePages = false
    }
  }

  logger.info(`Finished collecting topics. ${topics.length} topics collected`)

  return topics
}

const getTopicsPage = async (solrClient: SimpleSolrClient, offset: number, pageSize: number): Promise<CachedTopic[]> => {
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
