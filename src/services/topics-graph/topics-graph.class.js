/* eslint-disable no-unused-vars */
import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import { asFindAll } from '@/util/solr/adapters.js'
import { WellKnownKeys } from '@/cache.js'

import debugLib from 'debug'
const debug = debugLib('impresso/services:topics-graph')
import { min, max } from 'lodash-es'
import { NotFound } from '@feathersjs/errors'
import Topic from '@/models/topics.model.js'
import { measureTime } from '@/util/instruments.js'

const toNode = topic => ({
  id: topic.uid,
  uid: topic.uid,
  label: topic.getExcerpt().join(' - '),
  pos: {
    // initial position
    x: topic?.x ?? 0,
    y: topic?.y ?? 0,
  },
  pagerank: topic.pagerank,
  community: topic.community,
  countItems: topic.countItems,
  degree: topic.degree,
  language: topic.language,
  excerpt: topic.excerpt,
  model: topic.model,
})

export class TopicsGraph {
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
    const resolvers = buildResolvers(this.app)
    const topic = resolvers.topic(id)
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
      const result = await this.app.get('cacheManager').get(WellKnownKeys.Topics)
      /** @type {import('../../models/generated/schemas').Topic[]} */
      const deserialisedTopics = JSON.parse(result ?? '[]').map(d => new Topic(d))

      debug('[find] no filters, return all topics, n.', deserialisedTopics.length)
      deserialisedTopics.forEach(topic => {
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

      // ensure all nodes have valid positions
      nodes.forEach(n => {
        if (n.pos == null || typeof n.pos.x !== 'number' || typeof n.pos.y !== 'number') {
          n.pos = { x: 0, y: 0 }
        }
      })

      return {
        info: {
          extents: {
            x: [min(nodes.map(n => n.pos?.x ?? 0)), max(nodes.map(n => n.pos?.x ?? 0))],
            y: [min(nodes.map(n => n.pos?.y ?? 0)), max(nodes.map(n => n.pos?.y ?? 0))],
          },
        },
        nodes,
        links,
      }
    }

    const resolvers = buildResolvers(this.app)

    if (!params.sanitized.expand) {
      restrictToUids = params.sanitized.filters
        .filter(d => d.type === 'topic' && d.context === 'visualize')
        // concatenate different q
        .reduce((acc, d) => acc.concat(d.q), [])
        // unique values only
        .filter((value, index, self) => self.indexOf(value) === index)
      debug('[find] n of restrictToUids:', restrictToUids.length)
      // initial set of nodes
      await Promise.all(
        restrictToUids.map(async d => {
          nodesIndex[d] = nodes.length
          nodes.push({
            ...toNode(await resolvers.topic(d)),
            countItems: 0,
          })
        })
      )
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
    await Promise.all(
      solrResponse.facets.topic.buckets.map(async d => {
        if (restrictToUids.length && !restrictToUids.includes(d.val)) {
          return
        }
        if (typeof nodesIndex[d.val] === 'undefined') {
          nodesIndex[d.val] = nodes.length
          nodes.push({
            ...toNode(await resolvers.topic(d.val)),
            countItems: d.count,
          })
          // console.log('add', d.val, d.count);
        } else {
          nodes[nodesIndex[d.val]].countItems = d.count
        }
        // console.log('index', nodesIndex);
        await Promise.all(
          d.topNodes.buckets.map(async dd => {
            if (restrictToUids.length && !restrictToUids.includes(dd.val)) {
              return
            }
            if (typeof nodesIndex[dd.val] === 'undefined') {
              nodesIndex[dd.val] = nodes.length
              nodes.push(toNode(await resolvers.topic(dd.val)))
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
        )
      })
    )

    return {
      nodes,
      links,
      info,
    }
  }
}

export default function (options) {
  return new TopicsGraph(options)
}
