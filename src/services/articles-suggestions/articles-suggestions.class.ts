/* eslint-disable no-unused-vars */
import { SelectRequest, SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import { asFindAll } from '@/util/solr/adapters.js'
import { logger } from '@/logger.js'
import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import { ImpressoApplication } from '@/types.js'
import Article, { IFragmentsAndHighlights } from '@/models/articles.model.js'
import { FindMethodFields } from '@/services/content-items/content-items.class.js'
import { PrintContentItem } from '@/models/solr.js'

import { take } from 'lodash-es'
import { NotFound } from '@feathersjs/errors'
import Debug from 'debug'
const debug = Debug('impresso/services:articles-suggestions')
import ArticleTopic from '@/models/articles-topics.model.js'
import { ContentItemTopic } from '@/models/generated/schemas.js'
import { utils } from '@/solr.js'
const { wrapAll } = utils

const SIM_BY_TOPICS = 'topics'
const SIM_BY_TOPICS_SQEDIST = 'topics_sqedist'

interface Options {
  solr: SimpleSolrClient
  app?: ImpressoApplication
}

type ArticleTopicType = typeof ArticleTopic

export class ArticlesSuggestionsService {
  private readonly solr: SimpleSolrClient
  private readonly app: ImpressoApplication | undefined

  constructor({ solr, app }: Options) {
    this.solr = solr
    this.app = app
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
          logger.error(err)
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
      const topicsChoosen: ContentItemTopic[] = take(
        topics.sort((a: ContentItemTopic, b: ContentItemTopic) => b.relevance - a.relevance),
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
        fields: ['dist:${topicWeight}'].concat(FindMethodFields).join(','),
        offset: params.query.offset,
        limit: params.query.limit,
        sort: '${topicWeight} asc',
        params: { topicWeight },
      }

      const result = await this.solr.select(SolrNamespaces.Search, {
        body: requestBody,
      })

      if (result.response) {
        const solrFactory = Article.solrFactory(result.response as any as PrintContentItem & IFragmentsAndHighlights)
        const resolvers = buildResolvers(this.app!)

        result.response.docs = await Promise.all(
          result.response?.docs?.map(async doc => {
            const article: Article = solrFactory(doc as any as PrintContentItem & IFragmentsAndHighlights)

            article.locations = (await Promise.all(
              article.locations?.map(item => resolvers.location(item.uid)) ?? []
            )) as any
            article.persons = (await Promise.all(article.persons?.map(item => resolvers.person(item.uid)) ?? [])) as any

            return article as any
          })
        )
      }

      return wrapAll(result)
    }

    return {
      id,
      warning: 'no method defined!',
    }
  }
}
