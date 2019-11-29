/* eslint-disable no-unused-vars */
const { NotFound } = require('@feathersjs/errors');
const SolrService = require('../solr.service');


class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.app = app;
    this.name = name;
    this.solrClient = this.app.get('solrClient');
  }

  async find(params) {
    const namespace = `embeddings_${params.query.language}`;
    // use en to get embedding vector for the queried word
    //
    // https:// solrdev.dhlab.epfl.ch/solr/impresso_embeddings_de/select?q=word_s:amour&fl=embedding_bv
    const bv = await this.solrClient.findAll({
      q: `word_s:(${params.query.q})`,
      fl: 'embedding_bv',
      namespace,
    }).then((res) => {
      if (!res.response.docs.length) {
        throw new NotFound(`word "${params.query.q}" not found in available embeddings`);
      }
      return res.response.docs[0].embedding_bv;
    });

    const result = await this.solrClient.findAll({
      form: {
        q: `{!vectorscoring f="embedding_bv" vector_b64="${bv}"}`,
      },
      fl: '*,score',
      limit: params.query.limit,
      skip: params.query.skip,
      namespace,
    }).then(res => res.response);

    return {
      data: result.docs.map(d => d.word_s),
      total: result.numFound,
      limit: params.query.limit,
      skip: params.query.skip,
      info: {
        q: params.query.q,
        language: params.query.language,
      },
    };
  }

  async get(id, params) {
    return {
      id, text: `A new message with ID: ${id}!`,
    };
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
