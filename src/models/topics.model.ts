import lodash from 'lodash'
import { Topic as ITopic, TopicWord as ITopicWord } from './generated/schemas'
import { Topic as ISolrTopic } from './generated/solr'

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
  uid: string
  language: string
  community?: number | undefined
  pagerank?: number | undefined
  degree?: number | undefined
  hub?: number | undefined
  authority?: number | undefined
  x?: number | undefined
  y?: number | undefined
  relatedTopics?: { uid: string; w: number; avg?: number }[] | undefined
  relatedTopicsStats?:
    | { MinArticlesIncommon?: number; MaxRelatedTopicsToKeep?: number; RelatedThreshold?: number; Threshold?: number }
    | undefined
  countItems?: number | undefined
  excerpt?: ITopicWord[] | undefined
  words?: ITopicWord[] | undefined
  model?: string | undefined
  matches?: string[] | undefined

  constructor(
    {
      uid = '',
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
    }: {
      uid?: string
      language?: string
      model?: string
      words?: ITopicWord[]
      relatedTopics?: { uid: string; w: number; avg?: number }[]
      countItems?: number
      x?: number | string
      y?: number | string
      degree?: number | string
      pagerank?: number | string
      community?: number
    },
    {
      // options
      wordsInExcerpt = 5,
      checkHighlight = false,
    } = {}
  ) {
    this.uid = String(uid)
    this.language = String(language)
    this.words = words
    this.model = String(model)
    if (checkHighlight) {
      // get highlighted word
      const idx = lodash.findIndex(this.words, 'h')
      if (idx > wordsInExcerpt - 1) {
        this.excerpt = lodash
          .take(this.words, wordsInExcerpt - 1)
          .concat([new TopicWord({ w: '...', p: 0 }), this.words[idx]])
      } else {
        this.excerpt = lodash.take(this.words, wordsInExcerpt)
      }
    } else {
      this.excerpt = lodash.take(this.words, wordsInExcerpt)
    }
    this.countItems = countItems
    this.relatedTopics = relatedTopics
    this.x = typeof x === 'number' ? x : parseFloat(x)
    this.y = typeof y === 'number' ? y : parseFloat(y)
    this.degree = typeof degree === 'number' ? degree : parseInt(degree, 10)
    this.pagerank = typeof pagerank === 'number' ? pagerank : parseFloat(pagerank)
    this.community = community
  }

  getExcerpt() {
    return this.excerpt?.map(d => d.w || d)
  }

  static solrFactory() {
    return (topic: ISolrTopic) =>
      new Topic({
        uid: topic.id,
        language: topic.lg_s,
        words: topic.word_probs_dpf.split(' ').map(d => TopicWord.create(d)),
        model: topic.tp_model_s,
      })
  }

  static solrFacetFactory() {
    return (doc: ISolrTopic) => {
      const topic = new Topic({
        uid: doc.id,
        language: doc.lg_s,
        words: doc.word_probs_dpf.split(' ').map(d => TopicWord.create(d)),
        model: doc.tp_model_s,
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
          uid: sug.payload,
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

export const SOLR_FL: (keyof ISolrTopic)[] = ['id', 'lg_s', 'word_probs_dpf', 'tp_model_s']

export default Topic
