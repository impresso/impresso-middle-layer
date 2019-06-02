const rp = require('request-promise');
const { NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/solr');
const lodash = require('lodash');

const update = (config, params = {}) => {
  const p = {
    id: '',
    namespace: '',
    add: {},
    set: {},
    commit: true,
    ...params,
  };


  const url = `${config[p.namespace].update}?commit=${!!p.commit}`;
  const body = [{
    id: p.id,
    ...p.set,
    ...p.add,
    // commit: true,
  }];

  debug('update url:', url);
  debug('update body:', body);
  return rp.post({
    url,
    auth: config.auth.write,
    json: true,
    body,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    debug('update received', res);
    return 'ok';
  });
};

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

  debug(`findAll: request to '${_params.namespace}' endpoint. With PARAMS`, _params);

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
  if (_params.fq && _params.fq.length) {
    qs.fq = _params.fq;
  }
  if (_params.vars) {
    Object.assign(qs, _params.vars);
  }
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
  } else if (_params.collapse_by) {
    // using https://lucene.apache.org/solr/guide/6_6/collapse-and-expand-results.html
    if (!_params.collapse_fn) {
      _params.collapse_fn = '';
    }
    if (_params.expand) {
      qs.expand = true;
    }
    qs = {
      ...qs,
      fq: `{!collapse field=${_params.collapse_by} ${_params.collapse_fn}}`, // top 1 document matching.
    };
  }

  if (_params.fl) {
    qs.fl = Array.isArray(_params.fl) ? _params.fl.join(',') : _params.fl;
  } else {
    // default values for fields

  }

  let opts = {
    method: 'GET',
    url: endpoint,
    auth: config.auth,
    // qs,
    // form: _params.form,
    // json: true REMOVED because of duplicate keys
  };

  if (_params.form) {
    opts.form = _params.form;
    opts.form.fq = _params.fq;
    opts.qs = {
      start: _params.skip,
      rows: _params.limit,
    };
    // opts.form.q = opts.form.q + ' AND ' +
    opts.method = 'POST';
  } else {
    opts.qs = qs;
  }


  debug(`findAll: request to '${_params.namespace}' endpoint. With 'qs':`, qs);
  debug('\'findAll\': url', endpoint);
  return rp(opts).then((res) => {
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

/**
 * Return a classic data response for lazy people
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
const wrapAll = (res) => ({
  data: res.response.docs,
  total: res.response.numFound,
  limit: parseInt(res.responseHeader.params.rows, 10),
  skip:  parseInt(res.responseHeader.params.start, 10),
  info: {
    responseTime: {
      solr: res.responseHeader.QTime,
    },
  },
});

/**
 * [resolveAsync description]
 *
 * @param  {Object} config configuration item
 * @param  {Array} groups groups of services, each containing a list of items
 * @param  {Function} factory Instance generator
 * @return {Object} {uid: instance}
 */
const resolveAsync = async (config, groups, factory) => {
  debug(`resolveAsync':  ${groups.length} groups to resolve`);
  await Promise.all(groups.filter(group => group.items.length > 0).map((group, k) => {
    debug(`resolveAsync': findAll for namespace "${group.namespace}"`);
    const ids = group.items.map(d => d[group.idField || 'uid']);
    return findAll(config, {
      q: `id:${ids.join(' OR id:')}`,
      fl: group.Klass.SOLR_FL,
      limit: ids.length,
      namespace: group.namespace,
    }, factory || group.factory || group.Klass.solrFactory).then((res) => {
      res.response.docs.forEach((doc) => {
        const idx = ids.indexOf(doc.uid);
        groups[k].items[idx][group.itemField || 'item'] = doc;
      });
    });
  }));
  return groups;
};

const getSolrClient = config => ({
  findAll: (params, factory) => findAll(config, params, factory),
  update: (params, factory) => update(config, params, factory),
  suggest: (params, factory) => suggest(config, params, factory),
  utils: {
    wrapAll,
    resolveAsync: (items, factory) => resolveAsync(config, items, factory),
  },
});

module.exports = function (app) {
  const config = app.get('solr');
  app.set('solrClient', getSolrClient(config));
};

module.exports.client = getSolrClient;
