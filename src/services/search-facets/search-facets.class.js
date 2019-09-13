/* eslint-disable no-unused-vars */
const lodash = require('lodash');
const { NotFound, NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/services:search-facets');
const SearchFacet = require('../../models/search-facets.model');
const { SOLR_FACETS } = require('../../hooks/search');

class Service {
  constructor({
    app,
    name,
  }) {
    this.app = app;
    this.name = name;
  }

  async get(type, params) {
    // availabel facet types
    const validTypes = Object.keys(SOLR_FACETS);
    // required facet types
    const types = type.split(',').filter(d => validTypes.indexOf(d) !== -1);

    if (!types.length) {
      throw new NotFound();
    } else if (types.length > 2) {
      // limit number of facets per requests.
      throw new NotImplemented();
    }

    // init with limit and skip
    const facetsq = {
      offset: params.query.skip,
      limit: params.query.limit,
      sort: params.query.order_by,
    };

    debug(`GET facets query for type "${type}":`, facetsq);
    // facets is an Object, will be stringified for the solr query.
    // eslint-disable-next-line max-len
    // '{"newspaper":{"type":"terms","field":"meta_journal_s","mincount":1,"limit":20,"numBuckets":true}}'
    const facets = lodash(types)
      .map((d) => {
        const facet = {
          k: d,
          ...SOLR_FACETS[d],
          ...facetsq,
        };
        if (type === 'collection') {
          facet.prefix = params.authenticated ? params.user.uid : '-';
        }
        return facet;
      })
      .keyBy('k').value();

    debug('facets:', facets);

    // TODO: transform params.query.filters to match solr syntax
    const result = await this.app.get('solrClient').findAll({
      q: params.sanitized.sq,
      facets: JSON.stringify(facets),
      limit: 0,
      skip: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    });

    return types.map(t => new SearchFacet({
      type: t,
      ...result.facets[t],
    }));
  }

  async find(params) {
    debug(`find '${this.name}': query:`, params.sanitized, params.sanitized.sv);

    // TODO: transform params.query.filters to match solr syntax
    const result = await this.app.get('solrClient').findAll({
      q: params.sanitized.sq,
      // fq: params.sanitized.sfq,
      facets: params.query.facets,
      limit: 0,
      skip: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    });

    const total = result.response.numFound;

    debug(`find '${this.name}': SOLR found ${total} using SOLR params:`, result.responseHeader.params);
    console.log(result.facets);
    return {
      data: Object.keys(result.facets).map((type) => {
        if (typeof result.facets[type] === 'object') {
          return new SearchFacet({
            type,
            ...result.facets[type],
          });
        }
        return {
          type,
          count: result.facets[type],
        };
      }),
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
