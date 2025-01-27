/* eslint-disable no-unused-vars */
import { SelectRequest, SimpleSolrClient } from '../../internalServices/simpleSolr'
import { SolrNamespaces } from '../../solr'
import { asFindAll } from '../../util/solr/adapters'
const lodash = require('lodash')
const { NotFound } = require('@feathersjs/errors')
const debug = require('debug')('impresso/services:articles-suggestions')
const Article = require('../../models/articles.model')
const ArticleTopic = require('../../models/articles-topics.model')
const { measureTime } = require('../../util/instruments')
const {
  utils: { wrapAll },
} = require('../../solr')

const SIM_BY_TOPICS = 'topics'
const SIM_BY_TOPICS_SQEDIST = 'topics_sqedist'

interface Options {
  solr: SimpleSolrClient
}

type ArticleTopicType = typeof ArticleTopic

export class ArticlesSuggestionsService {
  private readonly solr: SimpleSolrClient

  constructor({ solr }: Options) {
    this.solr = solr
  }

  async get(id: string, params: any) {
    if ([SIM_BY_TOPICS_SQEDIST, SIM_BY_TOPICS].indexOf(params.query.method) !== -1) {
      debug(`get(${id}) method: ${params.query.method} load topics ...`)
      // const topics = await measureTime(
      //   () =>
      //     this.solrClient
      //       .findAll({
      //         q: `id:${id}`,
      //         fl: 'topics_dpfs',
      //       })
      //       .then(res => ArticleTopic.solrDPFsFactory(res.response.docs[0].topics_dpfs))
      //       .catch(err => {
      //         console.error(err)
      //         throw new NotFound()
      //       }),
      //   'articles-suggestions.solr.topics'
      // )
      const topics = await asFindAll(this.solr, 'search', {
        fq: `id:${id}`,
        fl: 'topics_dpfs',
      })
        .then(res => {
          const item = res?.response?.docs?.[0] as any
          return ArticleTopic.solrDPFsFactory(item?.topics_dpfs)
        })
        .catch(err => {
          console.error(err)
          throw new NotFound()
        })

      // if there are no topics, there is no point in trying to get
      // similar articles since topics are used for weighting.
      // return an empty array
      if (topics.length === 0) {
        return {
          data: [],
          offset: params.query.offset,
          limit: params.query.limit,
          total: 0,
        }
      }

      let topicWeight: string = '1'
      const topicsChoosen: ArticleTopicType[] = lodash.take(
        topics.sort((a: ArticleTopicType, b: ArticleTopicType) => b.relevance - a.relevance),
        params.query.amount
      )

      debug(`get(${id}) method: ${params.query.method} topics loaded: `, topicsChoosen)

      if (params.query.method === SIM_BY_TOPICS) {
        topicWeight = topicsChoosen
          .reduce((acc, d) => {
            acc.push(`abs(sub(${d.relevance},payload(topics_dpfs,${d.topicUid})))`)
            return acc
          }, [] as string[])
          .join(',')
        topicWeight = `sum(${topicWeight})`
      } else if (params.query.method === SIM_BY_TOPICS_SQEDIST) {
        // to obtain dist(1,x,y,z,e,f,g) -
        // Euclidean distance between (x,y,z) and (e,f,g) where each letter is a field name
        const tw = new Array(params.query.amount * 2)
        for (let i = 0; i < params.query.amount; i += 1) {
          tw[i] = topics[i].relevance
          tw[i + params.query.amount] = `payload(topics_dpfs,${topics[i].topicUid})`
        }
        topicWeight = `sqedist(${tw.join(',')})`
      }

      debug(`get(${id}) method: ${params.query.method} topics loaded, get articles using fn topicWeight`, topicWeight)

      const requestBody: SelectRequest['body'] = {
        query: '*:*',
        filter: `filter(topics_dpfs:*) AND NOT(id:${id})`,
        fields: Article.ARTICLE_SOLR_FL_LIST_ITEM.concat(['dist:${topicWeight}']),
        offset: params.query.offset,
        limit: params.query.limit,
        sort: '${topicWeight} asc',
        params: { topicWeight },
      }

      const result = await this.solr.select(SolrNamespaces.Search, {
        body: requestBody,
      })

      if (result.response) {
        result.response.docs = result.response?.docs?.map(Article.solrFactory(result.response))
      }

      return wrapAll(result)
    }

    return {
      id,
      warning: 'no method defined!',
    }
  }
}
