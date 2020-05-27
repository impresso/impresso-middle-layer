// @ts-check
const debug = require('debug')('impresso/solr');
const lodash = require('lodash');
const { URLSearchParams } = require('url');
const { preprocessSolrError } = require('./util/solr/errors');
const { initHttpPool } = require('./httpConnectionPool');

/**
 * @typedef {import('node-fetch').Response} Response
 * @typedef {import('./httpConnectionPool').ConnectionWrapper} ConnectionWrapper
 * @typedef {import('generic-pool').Pool<ConnectionWrapper>} ConnectionPool
 */

const SolrNamespaces = Object.freeze({
  Search: 'search',
  Mentions: 'mentions',
  Topics: 'topics',
  Entities: 'entities',
  Images: 'images',
  TextReusePassages: 'tr_passages',
  TextReuseClusters: 'tr_clusters',
  EmbeddingsDE: 'embeddings_de',
  EmbeddingsFR: 'embeddings_fr',
  EmbeddingsLB: 'embeddings_lb',
});

/**
 * Create headers object out of authentication details.
 * @param {{ user: string, pass: string }} auth authentication details
 * @returns {{ [key: string]: string }}
 */
const buildAuthHeaders = (auth) => {
  const authString = `${auth.user}:${auth.pass}`;

  return {
    Authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
  };
};

/**
 * Transform Solr response to a JavaScript object.
 * Impresso Solr comes with a plug-in that creates duplicate "highlighting" keys
 * in Solr response. To get around this issue we detect duplicate fields and replace
 * one of them with "fragments".
 * @param {string} text
 * @returns {any}
 */
const transformSolrResponse = (text) => {
  const matches = text.match(/^\s*"highlighting"\s*:\s*\{\s*$/mg);
  const replacedText = matches && matches.length > 1
    ? text.replace(/^\s*"highlighting"\s*:\s*\{\s*$/m, '"fragments":{')
    : text;

  return JSON.parse(replacedText);
};

/**
 * @param {Response} res response
 * @returns {Promise<Response>}
 */
const checkFetchResponseStatus = async (res) => {
  if (res.ok) return res;
  const error = new Error(res.statusText);
  // @ts-ignore
  error.response = {
    statusCode: res.status,
    body: await res.text(),
  };
  throw error;
};

/**
 * @param {{[key: string]: any}} queryParmeters
 * @returns {URLSearchParams}
 */
function toUrlSearchParameters(queryParmeters = {}) {
  const preparedQueryParameters = Object.keys(queryParmeters)
    .reduce((acc, key) => {
      if (queryParmeters[key] == null) return acc;
      return {
        ...acc,
        [key]: typeof queryParmeters[key] === 'string' ? queryParmeters[key] : JSON.stringify(queryParmeters[key]),
      };
    }, {});

  return new URLSearchParams(preparedQueryParameters);
}

/**
 * Build URL.
 *
 * @param {string} baseUrl
 * @param {{[key: string]: any}} queryParams
 *
 * @returns {string}
 */
function buildUrl(baseUrl, queryParams = {}) {
  const qp = toUrlSearchParameters(queryParams);
  return `${baseUrl}?${qp.toString()}`;
}

/**
 * @param {string} url
 * @param {object} params
 * @param {ConnectionPool} connectionPool
 */
async function executeRequest(url, params, connectionPool) {
  const connection = await connectionPool.acquire();
  if (connectionPool.available === 0) {
    console.warn(`No more available Solr connections out of max ${connectionPool.max}`);
  }

  try {
    return await connection.fetch(url, params)
      .then(checkFetchResponseStatus)
      .then(response => response.text())
      .then(transformSolrResponse)
      .catch((error) => { throw preprocessSolrError(error); });
  } finally {
    try {
      await connectionPool.release(connection);
    } catch (e) {
      const message = `
        Could not release Solr connection to the pool: ${e.message}.
        This does not cause an error for the user but should be looked into.
      `;
      console.warn(message);
    }
  }
}

/**
 * Send a raw 'POST' request to Solr.
 *
 * @param {any} config Solr configuration.
 * @param {ConnectionPool} connectionPool
 * @param {any} payload request body
 * @param {string} namespace Solr index to use.
 *
 * @returns {Promise<any>} response
 */
const postRaw = async (
  config, connectionPool, payload, queryParams = {}, namespace = SolrNamespaces.Search,
) => {
  const { endpoint } = config[namespace];
  const url = buildUrl(endpoint, queryParams);
  const opts = {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(config.auth),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };

  return executeRequest(url, opts, connectionPool);
};

/**
 * Send a raw 'POST' request with form payload to Solr.
 *
 * @param {any} config Solr configuration.
 * @param {ConnectionPool} connectionPool
 * @param {any} payload request body
 * @param {string} namespace Solr index to use.
 *
 * @returns {Promise<any>} response
 */
const postFormRaw = async (
  config, connectionPool, payload, queryParams = {}, namespace = SolrNamespaces.Search,
) => {
  const { endpoint } = config[namespace];
  const url = buildUrl(endpoint, queryParams);
  const body = toUrlSearchParameters(payload);

  const opts = {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(config.auth),
    },
    body,
  };

  return executeRequest(url, opts, connectionPool);
};

/**
 * Send a raw 'GET' request to Solr.
 *
 * @param {any} config Solr configuration.
 * @param {ConnectionPool} connectionPool
 * @param {any} params query parameters
 * @param {string} namespace Solr index to use.
 *
 * @returns {Promise<any>} response
 */
const getRaw = async (config, connectionPool, params, namespace = SolrNamespaces.Search) => {
  const { endpoint } = config[namespace];
  const url = buildUrl(endpoint, params);

  const options = {
    method: 'GET',
    headers: {
      ...buildAuthHeaders(config.auth),
      'Content-Type': 'application/json',
    },
    qs: params,
  };

  return executeRequest(url, options, connectionPool);
};

const suggest = async (config, connectionPool, params = {}, factory) => {
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
  return getRaw(config, connectionPool, qs, _params.namespace).then((res) => {
    const results = lodash.get(res, `suggest.${qs['suggest.dictionary']}.${qs['suggest.q']}`);

    debug(
      `'suggest' success, ${results.numFound} results in ${res.responseHeader.QTime}ms`,
      factory ? 'with factory' : 'but no factory specified',
    );
    if (!results) {
      return [];
    }
    if (factory) {
      results.suggestions = lodash(results.suggestions)
        .take(qs.rows)
        .map(factory())
        .value();
    }
    return lodash.take(results.suggestions, qs.rows);
  }).catch((error) => {
    throw preprocessSolrError(error);
  });
};
// TODO: `factory` is not used
const findAllPost = (config, connectionsPool, params = {}, factory) => {
  const qp = {
    q: '*:*',
    limit: 10,
    skip: 0,
    excerptLength: 30,
    namespace: 'search',
    requestOriginalPath: '...',
    ...params,
  };


  debug(`[findAllPost][${qp.requestOriginalPath}] request to '${qp.namespace}' endpoint. With PARAMS:`, qp);
  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  const endpoint = `${config[qp.namespace].endpoint}`;

  const data = {
    q: qp.q,
    start: qp.skip,
    rows: qp.limit,
    wt: 'json',
  };

  if (qp.fq && qp.fq.length) {
    data.fq = qp.fq;
  }
  if (qp.highlight_by) {
    data.hl = 'on';
    data['hl.fl'] = qp.highlight_by;
    if (qp.highlightProps) {
      Object.assign(data, qp.highlightProps);
    }
  }
  if (qp.vars) {
    Object.assign(data, qp.vars);
  }
  // transform order by if any
  if (qp.order_by) {
    data.sort = qp.order_by;
  }

  // transform facets if any
  //
  if (qp.facets) {
    data['json.facet'] = qp.facets;
  }

  if (qp.group_by && qp.group_by !== 'id') {
    Object.assign(data, {
      group: true,
      'group.field': qp.group_by,
      // 'group.main': true,
      'group.limit': 3, // top 3
      'group.ngroups': true,
    });
  } else if (qp.collapse_by) {
    // using https://lucene.apache.org/solr/guide/6_6/collapse-and-expand-results.html
    if (!qp.collapse_fn) {
      data.collapse_fn = '';
    }
    if (qp.expand) {
      data.expand = true;
    }
    Object.assign(data, {
      fq: `{!collapse field=${qp.collapse_by} ${qp.collapse_fn}}`, // top 1 document matching.
    });
  }

  if (qp.fl) {
    data.fl = Array.isArray(qp.fl) ? qp.fl.join(',') : qp.fl;
  }

  debug(`[findAllPost][${qp.requestOriginalPath}] request to '${qp.namespace}' endpoint: '${endpoint}'. Using 'data':`, data);
  return postFormRaw(config, connectionsPool, data, {}, qp.namespace).then((result) => {
    if (result.grouped) {
      result.response = {
        numFound: result.grouped[qp.group_by].ngroups,
        docs: result.grouped[qp.group_by].groups,
      };
    }

    debug(
      `[findAllPost][${qp.requestOriginalPath}] success, ${result.response.numFound} results in ${result.responseHeader.QTime}ms`,
      factory ? 'with factory' : '(no factory specified)',
    );

    if (factory) {
      result.response.docs = result.response.docs.map(factory(result));
    }
    return result;
  }).catch((error) => {
    throw preprocessSolrError(error);
  });
};

/**
 * request wrapper to get results from solr.
 * TODO Check grouping: https://lucene.apache.org/solr/guide/6_6/result-grouping.html
 * @param {object} config - config object for solr
 * @param {object} params - `q` with lucene search query; `limit` and `offset`
 */
const findAll = (config, connectionPool, params = {}, factory) => {
  const _params = {
    q: '*:*',
    limit: 10,
    skip: 0,
    excerptLength: 30,
    namespace: 'search',
    requestOriginalPath: '',
    ...params,
  };

  debug(`[findAll][${_params.requestOriginalPath}]: request to '${_params.namespace}' endpoint. With PARAMS`, _params);

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
  if (_params.highlight_by) {
    qs.hl = 'on';
    qs['hl.fl'] = _params.highlight_by;
    if (_params.highlightProps) {
      Object.assign(qs, _params.highlightProps);
    }
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

  const opts = {
    method: 'GET',
    url: endpoint,
    auth: config.auth,
    // qs,
    // form: _params.form,
    // json: true REMOVED because of duplicate keys
  };

  let requestPromise;

  if (_params.form) {
    // rewrite query string to get fq and limit the qs params
    opts.form = _params.form;
    opts.form.fq = _params.fq;
    opts.qs = {
      start: _params.skip,
      rows: _params.limit,
    };
    if (qs['json.facet']) {
      opts.qs['json.facet'] = qs['json.facet'];
    }
    // opts.form.q = opts.form.q + ' AND ' +
    opts.method = 'POST';
    requestPromise = postFormRaw(config, connectionPool, opts.form, opts.qs, _params.namespace);
  } else {
    opts.qs = qs;
    requestPromise = getRaw(config, connectionPool, qs, _params.namespace);
  }

  debug(`[findAll][${_params.requestOriginalPath}]: request to '${_params.namespace}' endpoint. With 'qs':`, JSON.stringify(opts.qs));
  debug(`[findAll][${_params.requestOriginalPath}]: url`, endpoint);

  return requestPromise.then((result) => {
    if (result.grouped) {
      result.response = {
        numFound: result.grouped[_params.group_by].ngroups,
        docs: result.grouped[_params.group_by].groups,
      };
    }

    debug(
      `[findAll][${_params.requestOriginalPath}] success, ${result.response.numFound} results in ${result.responseHeader.QTime}ms`,
      factory ? 'with factory' : 'but no factory specified',
    );

    if (factory) {
      result.response.docs = result.response.docs.map(factory(result));
    }
    return result;
  }).catch((error) => {
    throw preprocessSolrError(error);
  });
};

/**
 * Return a classic data response for lazy people
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
const wrapAll = res => ({
  data: res.response.docs,
  total: res.response.numFound,
  limit: parseInt(res.responseHeader.params.rows, 10),
  skip: parseInt(res.responseHeader.params.start, 10),
  info: {
    responseTime: {
      solr: res.responseHeader.QTime,
    },
    facets: res.facets,
  },
});

/**
 * [resolveAsync description]
 *
 * @param  {Object} config configuration item
 * @param  {Array} groups groups of services, each containing a list of items
 * @param  {Function} factory Instance generator
 * @return {Promise<any>} {uid: instance}
 */
const resolveAsync = async (config, connectionsPool, groups, factory) => {
  debug(`resolveAsync':  ${groups.length} groups to resolve`);
  await Promise.all(groups.filter(group => group.items.length > 0).map((group, k) => {
    debug(`resolveAsync': findAll for namespace "${group.namespace}"`);
    const ids = group.items.map(d => d[group.idField || 'uid']);
    return findAll(config, connectionsPool, {
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

/**
 * @param {any} config configuration.
 * @param {ConnectionPool} connectionsPool
 */
const getSolrClient = (config, connectionsPool) => ({
  findAll: (params, factory) => findAll(config, connectionsPool, params, factory),
  findAllPost: (params, factory) => findAllPost(config, connectionsPool, params, factory),
  suggest: (params, factory) => suggest(config, connectionsPool, params, factory),
  requestGetRaw: async (params, namespace) => getRaw(config, connectionsPool, params, namespace),
  requestPostRaw: async (payload, namespace) => postRaw(
    config, connectionsPool, payload, {}, namespace,
  ),
  utils: {
    resolveAsync: (items, factory) => resolveAsync(config, connectionsPool, items, factory),
  },
});

module.exports = function (app) {
  const config = app.get('solr');
  const connectionPool = initHttpPool(app.get('solrConnectionPool'));
  app.set('solrClient', getSolrClient(config, connectionPool));
};

module.exports.client = getSolrClient;

module.exports.SolrNamespaces = Object.freeze({
  Search: 'search',
  Mentions: 'mentions',
  Topics: 'topics',
  Entities: 'entities',
  Images: 'images',
  TextReusePassages: 'tr_passages',
  TextReuseClusters: 'tr_clusters',
  EmbeddingsDE: 'embeddings_de',
  EmbeddingsFR: 'embeddings_fr',
  EmbeddingsLB: 'embeddings_lb',
});

module.exports.utils = {
  wrapAll,
};
