const rp = require('request-promise');
const { NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/solr');
/**
 * request wrapper to get results from solr.
 * TODO Check grouping: https://lucene.apache.org/solr/guide/6_6/result-grouping.html
 * @param {object} config - config object for solr
 * @param {object} params - `q` with lucene search query; `limit` and `offset`
 */
const findAll = (config, params = {}, factory) => {
  const _params = {
    q: '*:*',
    limit: 10,
    skip: 0,
    excerptLength: 30,
    ...params,
  };

  const qs = {
    q: _params.q,

    start: _params.skip,
    rows: _params.limit,
    wt: 'json',
    // wt: 'xml'
  };

  // transform order by if any
  if (_params.order_by) {
    qs.sort = _params.order_by;
  }

  // transform facets if any
  //
  if (_params.facets) {
    qs['json.facet'] = _params.facets;
  }
  if (_params.fl) {
    qs.fl = Array.isArray(_params.fl) ? _params.fl.join(',') : _params.fl;
  } else {
    // default values for fields

  }

  debug('\'findAll\' request with \'qs\':', qs);

  return rp({
    url: `${config.endpoint}`,
    auth: config.auth,
    qs,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    // dummy handle dupes keys
    const result = JSON.parse(res.replace('"highlighting":{', '"fragments":{'));
    if (factory) {
      result.response.docs = result.response.docs.map(factory(result));
    } else {
      console.log('NO SOLR FACTORY');
    }
    return result;
  }).catch((err) => {
    debug(err);
    throw new NotImplemented();
    // throw feathers errors here.
  });
};


const getSolrClient = config => ({
  findAll: (params, factory) => findAll(config, params, factory),
});

module.exports = function (app) {
  const config = app.get('sequelize');
  const solr = getSolrClient(config);
  app.set('solrClient', solr);
};

module.exports.client = getSolrClient;
