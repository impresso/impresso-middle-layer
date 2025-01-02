/* eslint-disable no-unused-vars */
import { asFindAll } from '../../util/solr/adapters'

const debug = require('debug')('impresso/services:topics-graph')
const { min, max } = require('lodash')
const { NotFound } = require('@feathersjs/errors')
const { escapeValue } = require('../../util/solr/filterReducers')
const Topic = require('../../models/topics.model')
const topicsIndex = require('../../data')('topics')
const { measureTime } = require('../../util/instruments')

const toNode = topic => ({
  id: topic.uid,
  uid: topic.uid,
  label: topic.getExcerpt().join(' - '),
  pos: {
    // initial position
    x: topic.x,
    y: topic.y,
  },
  pagerank: topic.pagerank,
  community: topic.community,
  countItems: topic.countItems,
  degree: topic.degree,
  language: topic.language,
  excerpt: topic.excerpt,
  model: topic.model,
})

class TopicsGraph {
  constructor({ name }, app) {
    this.name = name
    this.app = app
  }

  setup(app) {
    this.app = app
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async get(id, params) {
    debug('[get] query:', params.sanitized)
    const topic = Topic.getCached(id)
    if (!topic.uid.length) {
      throw new NotFound()
    }
    const request = {
      q: `topics_dpfs:${id} AND (${params.sanitized.sq})`,
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
      vars: params.sanitized.sv,
    }

    // const solrResponse = await measureTime(
    //   () =>
    //     this.app.get('solrClient').findAll(request),
    //   'topics-graph.get.solr.topics'
    // )

    const solrResponse = await asFindAll(this.solr, 'search', request)

    const countItems = solrResponse.response.numFound
    const relatedTopicsParams = {
      limit: params.query.limit,
      offset: params.query.offset,
      total: 0,
      filters: params.sanitized.filters,
      QTime: solrResponse.responseHeader.QTime,
    }

    let relatedTopics = []
    if (countItems) {
      relatedTopics = solrResponse.facets.topic.buckets.map(d => ({
        uid: d.val,
        w: d.count,
      }))
      relatedTopicsParams.total = solrResponse.facets.topic.numBuckets
    }
    topic.countItems = countItems
    topic.relatedTopics = relatedTopics

    return topic
  }

  async find(params) {
    debug('[find] params:', params.sanitized)
    // consider only topic uids given as filters
    let restrictToUids = []
    const nodesIndex = {}
    const linksIndex = {}
    const nodes = []
    const links = []
    let info = {}
    const getOrCreateNode = (node, { forceUpdate = false } = {}) => {
      if (typeof nodesIndex[node.uid] === 'undefined') {
        nodesIndex[node.uid] = nodes.length
        nodes.push(node)
      } else if (forceUpdate) {
        // update
        nodes[nodesIndex[node.uid]] = node
      }
      return nodesIndex[node.uid]
    }

    const getOrCreateLink = link => {
      if (typeof linksIndex[link.id] === 'undefined') {
        linksIndex[link.id] = links.length
        links.push(link)
      }
      return linksIndex[link.id]
    }

    if (!params.sanitized.filters.length) {
      debug('[find] no filters, return all topics, n.', Object.keys(topicsIndex).length)
      Object.keys(topicsIndex.values).forEach(uid => {
        const topic = new Topic(topicsIndex.getValue(uid))
        const source = getOrCreateNode(toNode(topic), { forceUpdate: true })
        topic.relatedTopics.forEach((linked, i) => {
          if (i <= 5) {
            const target = getOrCreateNode(linked)
            const id = [topic.uid, linked.uid].sort().join('-')
            getOrCreateLink({
              id,
              w: linked.w,
              source,
              target,
            })
          }
        })
      })

      return {
        info: {
          extents: {
            x: [min(nodes.map(n => n.pos.x)), max(nodes.map(n => n.pos.x))],
            y: [min(nodes.map(n => n.pos.y)), max(nodes.map(n => n.pos.y))],
          },
        },
        nodes,
        links,
      }
    }

    if (!params.sanitized.expand) {
      restrictToUids = params.sanitized.filters
        .filter(d => d.type === 'topic' && d.context === 'visualize')
        // concatenate different q
        .reduce((acc, d) => acc.concat(d.q), [])
        // unique values only
        .filter((value, index, self) => self.indexOf(value) === index)
      debug('[find] n of restrictToUids:', restrictToUids.length)
      // initial set of nodes
      restrictToUids.forEach(d => {
        nodesIndex[d] = nodes.length
        nodes.push({
          ...toNode(Topic.getCached(d)),
          countItems: 0,
        })
      })
    }

    const request = {
      q: params.sanitized.sq,
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: restrictToUids.length ? restrictToUids.length : 20,
          offset: params.query.offset,
          numBuckets: true,
          facet: {
            topNodes: {
              type: 'terms',
              field: 'topics_dpfs',
              limit: restrictToUids.length ? 30 : 20,
              numBuckets: true,
            },
          },
        },
      }),
      limit: 0,
      offset: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    }

    // const solrResponse = await measureTime(
    //   () => this.app.get('solrClient').findAllPost(request),
    //   'topics.find.solr.topics'
    // )
    const solrResponse = await asFindAll(this.solr, 'search', request)

    info = {
      filters: params.sanitized.filters,
      limit: 20,
      offset: params.query.offset,
      QTime: solrResponse.responseHeader.QTime,
    }

    if (!solrResponse.response.numFound || !solrResponse.facets || !solrResponse.facets.topic) {
      return {
        nodes,
        links,
        info,
      }
    }
    // return solrResponse;
    solrResponse.facets.topic.buckets.forEach(d => {
      if (restrictToUids.length && !restrictToUids.includes(d.val)) {
        return
      }
      if (typeof nodesIndex[d.val] === 'undefined') {
        nodesIndex[d.val] = nodes.length
        nodes.push({
          ...toNode(Topic.getCached(d.val)),
          countItems: d.count,
        })
        // console.log('add', d.val, d.count);
      } else {
        nodes[nodesIndex[d.val]].countItems = d.count
      }
      // console.log('index', nodesIndex);
      d.topNodes.buckets.forEach(dd => {
        if (restrictToUids.length && !restrictToUids.includes(dd.val)) {
          return
        }
        if (typeof nodesIndex[dd.val] === 'undefined') {
          nodesIndex[dd.val] = nodes.length
          nodes.push(toNode(Topic.getCached(dd.val)))
        }
        // add link
        if (dd.val !== d.val) {
          const linkId = [nodesIndex[d.val], nodesIndex[dd.val]].sort().join('-')
          if (typeof linksIndex[linkId] === 'undefined') {
            linksIndex[linkId] = links.length
            links.push({
              id: linkId,
              source: nodesIndex[d.val],
              target: nodesIndex[dd.val],
              w: dd.count,
            })
            nodes[nodesIndex[d.val]].degree += 1
            nodes[nodesIndex[dd.val]].degree += 1
          }
        }
      })
    })

    return {
      nodes,
      links,
      info,
    }
  }
}

module.exports = function (options) {
  return new TopicsGraph(options)
}

module.exports.TopicsGraph = TopicsGraph
