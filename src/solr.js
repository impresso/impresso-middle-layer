const rp = require('request-promise');
const { NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/solr');
const lodash = require('lodash');

const suggest = (config, params = {}, factory) => {
  const _params = {
    q: '',
    dictionary: 'm_suggester_infix',
    cfq: '', // or 'Person' or 'Location'
    limit: 10,
    skip: 0,
    excerptLength: 30,
    namespace: 'mentions',
    ...params,
  };

  const qs = {
    'suggest.q': _params.q,
    'suggest.cfq': _params.cfq,
    'suggest.dictionary': _params.dictionary,
    start: _params.skip,
    rows: _params.limit,
    wt: 'json',
    // wt: 'xml'
  };

  // suggest?suggest.q=Vic&suggest.dictionary=m_suggester_infix&suggest.cfq=Person
  debug(`suggest: request to '${_params.namespace}' url: `, qs);

  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  const url = `${config[_params.namespace].suggest}`;

  return rp({
    url,
    auth: config.auth,
    json: true,
    qs,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    const results = lodash.get(res, `suggest.${qs['suggest.dictionary']}.${qs['suggest.q']}`);

    debug(
      `'suggest' success, ${results.numFound} results in ${res.responseHeader.QTime}ms`,
      factory ? 'with factory' : 'but no factory specified',
    );
    if (!results) {
      return [];
    } else if (factory) {
      results.suggestions = results.suggestions.map(factory());
    }
    return results.suggestions;
  }).catch((err) => {
    debug(err);
    throw new NotImplemented();
    // throw feathers errors here.
  });
};
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
    namespace: 'search',
    ...params,
  };
  debug(`findAll: request to '${_params.namespace}' endpoint.`);

  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  const endpoint = `${config[_params.namespace].endpoint}`;

  let qs = {
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

  if (_params.group_by && _params.group_by !== 'id') {
    qs = {
      ...qs,
      group: true,
      'group.field': _params.group_by,
      // 'group.main': true,
      'group.limit': 3, // top 3
      'group.ngroups': true,
    };
  }

  if (_params.fl) {
    qs.fl = Array.isArray(_params.fl) ? _params.fl.join(',') : _params.fl;
  } else {
    // default values for fields

  }


  debug(`findAll: request to '${_params.namespace}' endpoint. With 'qs':`, qs);

  return rp({
    url: endpoint,
    auth: config.auth,
    qs,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    // dummy handle dupes keys
    const result = JSON.parse(res.replace('"highlighting":{', '"fragments":{'));

    if (result.grouped) {
      result.response = {
        numFound: result.grouped[_params.group_by].ngroups,
        docs: result.grouped[_params.group_by].groups,
      };
    }

    debug(
      `'findAll' success, ${result.response.numFound} results in ${result.responseHeader.QTime}ms`,
      factory ? 'with factory' : 'but no factory specified',
    );

    if (factory) {
      result.response.docs = result.response.docs.map(factory(result));
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
  suggest: (params, factory) => suggest(config, params, factory),
});

module.exports = function (app) {
  const config = app.get('sequelize');
  const solr = getSolrClient(config);
  app.set('solrClient', solr);
};

module.exports.client = getSolrClient;
