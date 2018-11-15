/* eslint-disable no-unused-vars */
const chrono = require('chrono-node');
const solr = require('../../solr');
const moment = require('moment');
const { neo4jRecordMapper, neo4jToLucene } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;
const Mention = require('../../models/mentions.model');
const lodash = require('lodash');

const MULTI_YEAR_RANGE = /^\s*(\d{4})(\s*(to|-)\s*(\d{4})\s*)?$/;


/**
 * Retrieve a list of mention filters for the autocomplete function
 * @param  {Object}  [config={}] Solr configuration
 * @param  {Object}  [params={}] must contains a search query `params.query.q` and `namespace`
 * @return {Promise}
 */
const getMentions = async ({ config = {}, params = {} } = {}) => {
  // exclude suggestion when there is a complete regexp
  if (params.query.q.match(/^\/|\/$/)) {
    return [];
  }

  const q = params.query.q
    // regexp
    .replace('.*', ' ')
    .replace(/[^\s0-9A-zÀ-Ÿ']|[[\]]/g, '')
    .trim()
    .split(/\s/)
    .map(d => `l_s:${d}*`)
    .join(' AND ');
  console.log(`transform ${params.query.q} in ${q}`);
  const results = await solr.client(config).findAll({
    // use solr mention index for that.
    namespace: 'mentions',
    // top three mentions to be used as exact
    limit: 3,
    // sort by frequence
    order_by: 'fq_i desc',
    // the super simplified query
    q,
  }, Mention.solrFactory);

  if (!results.response.numFound) {
    return [];
  }

  return results.response.docs.map(d => ({
    type: d.type,
    q: d.name,
    context: 'include',
  }));
};


class Service extends Neo4jService {
  async find(params) {
    const self = this;

    const asregex = async () => {
      if (params.query.q.indexOf('/') === 0) {
        try {
          const a = RegExp(params.query.q);
        } catch (e) {
          return [];
        }

        return [
          {
            type: 'regex',
            q: params.query.q,
            context: 'include',
          },
        ];
      }
      return [];
    };

    const articletitles = async () => {

    };

    const dateranges = async () => {
      const myears = params.query.q.match(MULTI_YEAR_RANGE);

      if (myears) {
        const start = moment.utc(`${myears[1]}-01-01`).format();
        const end = moment.utc(myears[4] ? `${myears[4]}-12-31` : `${myears[1]}-12-31`).endOf('day').format();

        return [{
          type: 'daterange',
          context: 'include',
          daterange: `${start} TO ${end}`,
        }];
      }
      // if a date hasnt been recognized by our basic regex.
      const asdate = chrono.parse(params.query.q);

      if (asdate.length) {
        return asdate.map((d) => {
          if (!d.start) {
            return false;
          }
          const start = moment.utc(d.start.date()).format();
          let end;
          if (d.end && d.end.knownValues.day) {
            end = moment.utc(d.end.date()).endOf('day').format();
          } else if (d.end && d.end.knownValues.month) {
            end = moment.utc(d.end.date()).endOf('month').format();
          } else if (d.end && d.end.knownValues.month) {
            end = moment.utc(d.end.date()).endOf('year').format();
          } else if (d.start.knownValues.day) {
            end = moment.utc(d.start.date()).endOf('day').format();
          } else if (d.start.knownValues.month) {
            end = moment.utc(d.start.date()).endOf('month').format();
          } else if (d.start.knownValues.year) {
            end = moment.utc(d.start.date()).endOf('year').format();
          }

          if (!end) {
            return false;
          }
          return {
            type: 'daterange',
            text: d.text,
            context: 'include',
            daterange: `${start} TO ${end}`,
          };
        }).filter(d => d !== false);
      }

      return [];
    };

    const qToLucene = neo4jToLucene(params.query.q);

    const entities = async () => this._run(this.queries.find, {
      ...params.query,
      q: qToLucene,
    })
      .then(result => result.records
        .map(neo4jRecordMapper)
        .map(record => ({
          type: 'entity',
          entity: record,
        })))
      .catch(err => []);

    // let newspapers = () => this._run()
    const results = await Promise.all([
      asregex(),
      dateranges(), // dates(),
      entities(),
      getMentions({
        params,
        config: this.app.get('solr'),
      }),
      // newspapers()
    ]).then(values => Neo4jService.wrap(lodash.flatten(values.filter(d => !!d.length))));

    return results;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
module.exports.utils = {
  getMentions,
};
