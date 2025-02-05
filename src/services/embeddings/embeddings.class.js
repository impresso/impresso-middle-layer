import { escapeValue } from '../../util/solr/filterReducers'
const debug = require('debug')('impresso/services:embeddings')
const { NotFound } = require('@feathersjs/errors')
const { measureTime } = require('../../util/instruments')
const { asFindAll } = require('../../util/solr/adapters')

class Service {
  constructor({ app = null, name = '' }) {
    this.app = app
    this.name = name
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async find(params) {
    const namespace = `embeddings_${params.query.language}`
    // use en to get embedding vector for the queried word
    //
    // https:// solrdev.dhlab.epfl.ch/solr/impresso_embeddings_de/select?q=word_s:amour&fl=embedding_bv
    debug('[find] with params', params.query)

    const bvRequest = {
      q: `word_s:(${escapeValue(params.query.q)})`,
      fl: 'embedding_bv',
      namespace,
    }
    const bv = await measureTime(
      () =>
        asFindAll(this.solr, namespace, bvRequest).then(res => {
          if (!res.response.docs.length) {
            throw new NotFound(`word "${params.query.q}" not found in available embeddings`)
          }
          return res.response.docs[0].embedding_bv
        }),
      'embeddings.find.get_embedding'
    )

    const request = {
      form: {
        q: `{!vectorscoring f="embedding_bv" vector_b64="${bv}"}`,
      },
      fl: '*,score',
      limit: params.query.limit,
      offset: params.query.offset,
      namespace,
    }
    const result = await measureTime(
      // () => this.solrClient.findAll(request).then(res => res.response),
      () => asFindAll(this.solr, namespace, request).then(res => res.response),
      'embeddings.find.find_similar_embeddings'
    )

    return {
      data: result.docs.map(d => d.word_s),
      total: result.numFound,
      limit: params.query.limit,
      offset: params.query.offset,
      info: {
        q: params.query.q,
        language: params.query.language,
      },
    }
  }

  async get(id, params) {
    return {
      id,
      text: `A new message with ID: ${id}!`,
    }
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
