import { findIndex, take } from 'lodash-es'
import { Topic as ITopic, TopicWord as ITopicWord } from '@/models/generated/app/entities.js'
import type { CachedTopic } from '@/models/generated/app/cache.js'
import type { Topic as ISolrTopic } from '@/models/consolidated/solr/index.js'

export type TopicLabelFields = Pick<
  CachedTopic,
  | 'topicNumber'
  | 'description'
  | 'metadata'
  | 'category'
  | 'label'
  | 'longLabel'
  | 'confidence'
  | 'representativeTerms'
  | 'generatedBy'
>

type TopicLabelSolrFields = Pick<
  ISolrTopic,
  | 'tp_nb_i'
  | 'tp_desc_s'
  | 'tp_meta_s'
  | 'topic_type_s'
  | 'label_short_s'
  | 'label_long_txt_en'
  | 'confidence_s'
  | 'representative_terms_ss'
  | 'generated_by_s'
>

export const topicLabelFieldsFromSolr = (doc: TopicLabelSolrFields): TopicLabelFields => ({
  topicNumber: doc.tp_nb_i,
  description: doc.tp_desc_s,
  metadata: doc.tp_meta_s,
  category: doc.topic_type_s,
  label: doc.label_short_s,
  longLabel: doc.label_long_txt_en,
  confidence: doc.confidence_s,
  representativeTerms: doc.representative_terms_ss,
  generatedBy: doc.generated_by_s,
})

class TopicWord implements ITopicWord {
  w: string
  p: number
  h?: boolean

  constructor({ w = '', p = 0.0 }: { w?: string; p: number | string }, { checkHighlight = false } = {}) {
    this.w = String(w)
    this.p = typeof p === 'number' ? p : parseFloat(p)
    if (checkHighlight) {
      this.h = this.w.split(/<[^>]*>/).length > 2
    }
  }

  static create(pipe: string): TopicWord {
    const parts = pipe.split('|')
    return new TopicWord({
      w: parts.shift(),
      p: parts?.[0] ?? 0,
    })
  }
}

class Topic implements ITopic {
  static readonly SOLR_FL: string[] = [
    'id',
    'lg_s',
    'word_probs_dpf',
    'tp_model_s',
    'tp_nb_i',
    'tp_desc_s',
    'tp_meta_s',
    'topic_type_s',
    'label_short_s',
    'label_long_txt_en',
    'confidence_s',
    'representative_terms_ss',
    'generated_by_s',
  ] satisfies (keyof ISolrTopic)[]

  id: string
  language: string
  community?: number | undefined
  pagerank?: number | undefined
  degree?: number | undefined
  hub?: number | undefined
  authority?: number | undefined
  x?: number | undefined
  y?: number | undefined
  relatedTopics?: { id: string; w: number; avg?: number }[] | undefined
  relatedTopicsStats?:
    | { MinArticlesIncommon?: number; MaxRelatedTopicsToKeep?: number; RelatedThreshold?: number; Threshold?: number }
    | undefined
  countItems?: number | undefined
  excerpt?: ITopicWord[] | undefined
  words?: ITopicWord[] | undefined
  model?: string | undefined
  matches?: string[] | undefined
  topicNumber?: number | undefined
  description?: string | undefined
  metadata?: string | undefined
  category?: string | undefined
  label?: string | undefined
  longLabel?: string | undefined
  confidence?: 'high' | 'medium' | 'low' | undefined
  representativeTerms?: string[] | undefined
  generatedBy?: string | undefined

  constructor(
    {
      id = '',
      language = '',
      model = '',
      // array of topicWords
      words = [],
      relatedTopics = [],
      countItems = -1,
      x = 0,
      y = 0,
      degree = 0,
      pagerank = 0,
      community = undefined,
      topicNumber = undefined,
      description = undefined,
      metadata = undefined,
      category = undefined,
      label = undefined,
      longLabel = undefined,
      confidence = undefined,
      representativeTerms = undefined,
      generatedBy = undefined,
    }: {
      id?: string
      language?: string
      model?: string
      words?: ITopicWord[]
      relatedTopics?: { id: string; w: number; avg?: number }[]
      countItems?: number
      x?: number | string
      y?: number | string
      degree?: number | string
      pagerank?: number | string
      community?: number
    } & Partial<TopicLabelFields>,
    {
      // options
      wordsInExcerpt = 5,
      checkHighlight = false,
    } = {}
  ) {
    this.id = String(id)
    this.language = String(language)
    this.words = words
    this.model = String(model)
    if (checkHighlight) {
      // get highlighted word
      const idx = findIndex(this.words, 'h')
      if (idx > wordsInExcerpt - 1) {
        this.excerpt = take(this.words, wordsInExcerpt - 1).concat([new TopicWord({ w: '...', p: 0 }), this.words[idx]])
      } else {
        this.excerpt = take(this.words, wordsInExcerpt)
      }
    } else {
      this.excerpt = take(this.words, wordsInExcerpt)
    }
    this.countItems = countItems
    this.relatedTopics = relatedTopics
    this.x = typeof x === 'number' ? x : parseFloat(x)
    this.y = typeof y === 'number' ? y : parseFloat(y)
    this.degree = typeof degree === 'number' ? degree : parseInt(degree, 10)
    this.pagerank = typeof pagerank === 'number' ? pagerank : parseFloat(pagerank)
    this.community = community
    this.topicNumber = topicNumber
    this.description = description
    this.metadata = metadata
    this.category = category
    this.label = label
    this.longLabel = longLabel
    this.confidence = confidence
    this.representativeTerms = representativeTerms
    this.generatedBy = generatedBy
  }

  getExcerpt() {
    return this.excerpt?.map(d => d.w || d)
  }

  static solrFactory() {
    return (topic: ISolrTopic) =>
      new Topic({
        id: topic.id,
        language: topic.lg_s,
        words: topic.word_probs_dpf.split(' ').map(d => TopicWord.create(d)),
        model: topic.tp_model_s,
        ...topicLabelFieldsFromSolr(topic),
      })
  }

  static solrFacetFactory() {
    return (doc: ISolrTopic) => {
      const topic = new Topic({
        id: doc.id,
        language: doc.lg_s,
        words: doc.word_probs_dpf.split(' ').map(d => TopicWord.create(d)),
        model: doc.tp_model_s,
        ...topicLabelFieldsFromSolr(doc),
      })
      // once created get rid of it
      topic.words = []
      // console.log('solrFacetFactory')
      return topic
    }
  }

  static solrSuggestFactory() {
    const opts = {
      checkHighlight: true,
    }

    return (sug: ISuggestion) =>
      new Topic(
        {
          id: sug.payload,
          language: sug.payload.split('_').pop(),
          words: sug.term.split(' ').map(
            w =>
              new TopicWord(
                {
                  w,
                  p: 0,
                },
                opts
              )
          ),
        },
        opts
      )
  }
}

interface ISuggestion {
  term: string
  payload: string
}

export const SOLR_FL = Topic.SOLR_FL

export default Topic
