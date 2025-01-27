/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:topics')
const { NotFound } = require('@feathersjs/errors')
const { escapeValue } = require('../../util/solr/filterReducers')
const SequelizeService = require('../sequelize.service')
const Topic = require('../../models/topics.model')
const { measureTime } = require('../../util/instruments')
const { asFindAll, asGet } = require('../../util/solr/adapters')
const { buildResolvers } = require('../../internalServices/cachedResolvers')
const { SolrNamespaces } = require('../../solr')

class Service {
  constructor({ app = null, name = '' }) {
    this.name = String(name)
    this.app = app
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async find(params) {
    // if there's a q, get all suggested topics matching q in their words (they are 300 max)
    const topics = {}
    let qtime = 0
    // fill topics dict with results
    if (params.sanitized.q && params.sanitized.q.length > 2) {
      const q = escapeValue(params.sanitized.q).split(/\s/).join(' OR ')

      const request = {
        q: `topic_suggest:${q}`,
        highlight_by: 'topic_suggest',
        order_by: params.query.order_by,
        namespace: 'topics',
        limit: 300,
        offset: 0,
      }
      // const solrSuggestResponse = await measureTime(
      //   () => this.app.get('solrClient').findAll(request),
      //   'topics.find.solr.topics_suggest'
      // )
      const solrSuggestResponse = await asFindAll(this.solr, 'topics', request)

      // set initial query time for suggestions
      qtime = solrSuggestResponse.responseHeader.QTime

      debug('[find] params.sanitized.q:', params.sanitized, 'load topic uids...')
      // no ids? return empty stuff
      if (!solrSuggestResponse.response.numFound) {
        return {
          data: [],
          total: 0,
          limit: params.query.limit,
          offset: params.query.offset,
          info: {
            QTime: qtime,
            filters: params.sanitized.filters,
          },
        }
      }

      if (!params.sanitized.filters.length) {
        const resolvers = buildResolvers(this.app)

        return {
          total: solrSuggestResponse.response.numFound,
          data: Promise.all(
            solrSuggestResponse.response.docs
              .slice(params.query.offset, params.query.offset + params.query.limit)
              .map(async d => {
                const t = await resolvers.topic(d.id)
                if (solrSuggestResponse.highlighting[t.uid].topic_suggest) {
                  t.matches = solrSuggestResponse.highlighting[t.uid].topic_suggest
                }
                return t
              })
          ),
          limit: params.query.limit,
          offset: params.query.offset,
          info: {
            QTime: qtime,
            filters: params.sanitized.filters,
          },
        }
      }

      // otherwise, fill topic index
      solrSuggestResponse.response.docs.forEach((d, i) => {
        topics[d.id] = {
          order: i,
          matches: solrSuggestResponse.highlighting[d.id].topic_suggest,
        }
      })
    }

    const uids = Object.keys(topics)
    const solrQueryParts = []

    if (uids.length) {
      solrQueryParts.push(['(', uids.map(d => `topics_dpfs:${d}`).join(' OR '), ')'].join(''))
    }
    if (params.sanitized.filters.length) {
      solrQueryParts.push(`(${params.sanitized.sq})`)
    }
    if (!solrQueryParts.length) {
      solrQueryParts.push('*:*')
    }

    debug('[find] params.sanitized:', params.sanitized, '- topic uids:', uids.length)

    const request = {
      q: solrQueryParts.join(' AND '),
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: 300,
          offset: 0,
          numBuckets: true,
        },
      }),
      limit: 0,
      offset: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    }
    // console.log(topics);
    // const solrResponse = await measureTime(
    //   () => this.app.get('solrClient').findAllPost(request),
    //   'topics.find.solr.posts'
    // )
    const solrResponse = await asFindAll(this.solr, 'topics', request)

    debug('[find] solrResponse total document matching:', solrResponse.response.numFound)
    if (!solrResponse.response.numFound || !solrResponse.facets || !solrResponse.facets.topic) {
      debug('[find] warning, no topic buckets found.')
      return {
        data: [],
        limit: params.query.limit,
        offset: params.query.offset,
        total: 0,
        info: {
          QTime: solrResponse.responseHeader.QTime,
          filters: params.sanitized.filters,
        },
      }
    }

    let total = solrResponse.facets.topic.numBuckets
    let data = solrResponse.facets.topic.buckets

    if (uids.length) {
      debug('[find] filtering out facets, initial total approx:', solrResponse.facets.topic.numBuckets)
      // filter out facets based on their uid.
      data = solrResponse.facets.topic.buckets.filter(d => uids.includes(d.val))
      debug('[find] new total: ', data.length)
      total = data.length
      // get only the portion we need.
      data = data.slice(params.query.offset, params.query.offset + params.query.limit)
    }

    const resolvers = buildResolvers(this.app)
    // remap data
    data = Promise.all(
      data.map(async d => {
        const topic = await resolvers.topic(d.val)
        if (uids.length && topics[d.val]) {
          topic.matches = topics[d.val].matches
        }
        topic.countItems = d.count
        return topic
      })
    )

    return {
      total,
      data,
      limit: params.query.limit,
      offset: params.query.offset,
      info: {
        QTime: solrResponse.responseHeader.QTime,
        filters: params.sanitized.filters,
      },
    }
  }

  async get(id, params) {
    const resolvers = buildResolvers(this.app)

    return measureTime(
      () =>
        asGet(this.solr, SolrNamespaces.Topics, id, params, Topic.solrFactory).then(async topic => {
          const cached = await resolvers.topic(id)
          topic.countItems = cached.countItems
          topic.relatedTopics = cached.relatedTopics
          return topic
        }),
      'topics.get.solr.topics'
    )
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)))
    }

    return data
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    return data
  }

  async remove(id, params) {
    return { id }
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
