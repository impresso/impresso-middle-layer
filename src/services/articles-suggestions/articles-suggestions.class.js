/* eslint-disable no-unused-vars */
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

class Service {
  constructor(options) {
    this.app = options.app
    this.solrClient = options.app.get('solrClient')
    this.name = options.name
    this.options = options
  }

  async get(id, params) {
    if ([SIM_BY_TOPICS_SQEDIST, SIM_BY_TOPICS].indexOf(params.query.method) !== -1) {
      debug(`get(${id}) method: ${params.query.method} load topics ...`)
      const topics = await measureTime(
        () =>
          this.solrClient
            .findAll({
              q: `id:${id}`,
              fl: 'topics_dpfs',
            })
            .then(res => ArticleTopic.solrDPFsFactory(res.response.docs[0].topics_dpfs))
            .catch(err => {
              console.error(err)
              throw new NotFound()
            }),
        'articles-suggestions.solr.topics'
      )

      let topicWeight
      const topicsChoosen = lodash.take(
        topics.sort((a, b) => b.relevance - a.relevance),
        params.query.amount
      )

      debug(`get(${id}) method: ${params.query.method} topics loaded: `, topicsChoosen)

      if (params.query.method === SIM_BY_TOPICS) {
        topicWeight = topicsChoosen
          .reduce((acc, d) => {
            acc.push(`abs(sub(${d.relevance},payload(topics_dpfs,${d.topicUid})))`)
            return acc
          }, [])
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
      return measureTime(
        () =>
          this.solrClient
            .findAll(
              {
                q: `filter(topics_dpfs:*) AND NOT(id:${id})`,
                // eslint-disable-next-line no-template-curly-in-string
                fl: Article.ARTICLE_SOLR_FL_LIST_ITEM.concat(['dist:${topicWeight}']),
                vars: {
                  topicWeight,
                },
                offset: params.query.offset,
                limit: params.query.limit,
                // eslint-disable-next-line no-template-curly-in-string
                order_by: '${topicWeight} asc',
              },
              Article.solrFactory
            )
            .then(wrapAll)
            .catch(err => {
              console.error(err)
              throw new NotFound()
            }),
        'articles-suggestions.solr.articles'
      )
    }

    return {
      id,
      warning: 'no method defined!',
    }
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
