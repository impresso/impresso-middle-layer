


const rp = require('request-promise');
const { NotImplemented } = require('@feathersjs/errors');


/**
 * request wrapper to get results from solr.
 * @param {object} config - config object for solr
 * @param {object} params - `q` with lucene search query; `limit` and `offset`
 */
const findAll = (config, params={}) => {
  params = {
    q: '*:*',
    limit: 10,
    offset: 0,
    ... params
  }

  return rp({
    url: `${config.endpoint}`,
    auth: config.auth,
    qs: {
      q: params.q,
      start: params.offset,
      rows: params.limit,
      wt: 'json'
    },
    json: true
  }).catch((err) => {
    throw new NotImplemented();
    // throw feathers errors here.
  });
  return results;
}


const getSolrClient = config => {
  return {
    findAll: params => findAll(config, params)
  }
}

module.exports = function (app) {
  const config = app.get('sequelize');
  const solr = getSolrClient(config);
}

module.exports.client = getSolrClient;
