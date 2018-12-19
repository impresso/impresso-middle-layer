/* eslint-disable no-unused-vars */
const chrono = require('chrono-node');
const moment = require('moment');
const lodash = require('lodash');

const solr = require('../../solr');
const { neo4jRecordMapper, neo4jToLucene } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;

const Mention = require('../../models/mentions.model');
const Topic = require('../../models/topics.model');
const Suggestion = require('../../models/suggestions.model');

const MULTI_YEAR_RANGE = /^\s*(\d{4})(\s*(to|-)\s*(\d{4})\s*)?$/;

const isPlainText = q =>
  // exclude suggestion when there is a complete regexp
  !q.match(/^\/|\/$/);

const makePlainText = q =>
  q.replace(/[^\s0-9A-zÀ-Ÿ']|[[\]]/g, '').trim();

const getNewspapers = async ({ app, params = {} } = {}) => {
  if (!isPlainText(params.query.q)) {
    return [];
  }
  // const q = makePlainText(); // regexp
  // get newspapers like xy
  //
  const results = await app.service('newspapers').find({
    query: {
      q: params.query.q,
      limit: 3,
    },
  });

  // console.log('getNewspapers', results);
  return results.data.map(d => ({
    type: 'newspaper',
    q: d.uid,
    uid: d.uid,
    item: d,
    context: 'include',
  }));
};

const getTopics = async ({ q = '', config = {}, params = {} } = {}) => {
  if (!q.length) {
    return [];
  }
  // clean fpr get mentions
  const results = await solr.client(config).suggest({
    // use solr mention index for that.
    namespace: 'topics',
    // query
    q,
  }, () => (doc) => {
    const topic = Topic.solrSuggestFactory()(doc);
    // console.log(topic);
    return new Suggestion({
      q: topic.uid,
      h: topic.getExcerpt().join(' '),
      type: 'topic',
      item: topic,
    });
  });
  return lodash.take(results, 5);
};

const getCollections = async ({ q  = '', app, user, params = {} } = {}) => {
  if (!q.length) {
    return [];
  }
  const results = await app.service('collections').find({
    query: {
      q,
      limit: 3,
    },
    user,
  });
  return results.data.map(d => new Suggestion({
    q: d.uid,
    h: d.name,
    type: 'collection',
    item: d,
  }));
}
/**
 * Retrieve a list of mention filters for the autocomplete function
 * @param  {Object}  [config={}] Solr configuration
 * @param  {Object}  [params={}] must contains a search query `params.query.q`
 * @return {Promise}
 */
const getMentions = async ({ config = {}, params = {} } = {}) => {
  if (!isPlainText(params.query.q)) {
    return [];
  }

  const q = params.query.q // regexp
    .replace(/[^\s0-9A-zÀ-Ÿ']|[[\]]/g, '')
    .trim();

  // clean fpr get mentions
  const results = await solr.client(config).suggest({
    // use solr mention index for that.
    namespace: 'mentions',
    // query
    q,
  }, () => (doc) => {
    const mention = new Mention({
      name: doc.term.replace(/<[^>]*>/g, ''),
      frequence: doc.weight,
      type: doc.payload,
    });

    return new Suggestion({
      q: mention.name,
      h: doc.term,
      type: mention.type,
      item: mention,
    });
  });

  return lodash.take(results, 5);
  // // apply limit
  // return lodash.take(results, 5).map(d => new Suggestion({
  //   h: d.name,
  //   type: d.type,
  //   item: d,
  // }));
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

    const qPlainText = makePlainText(params.query.q);

    // let newspapers = () => this._run()
    const results = await Promise.all([
      asregex(),
      dateranges(), // dates(),
      // entities(),
      getCollections({
        q: qPlainText,
        params,
        app: this.app,
        user: params.user,
      }),
      getNewspapers({
        q: qPlainText,
        params,
        app: this.app,
      }),
      getTopics({
        q: qPlainText,
        params,
        config: this.app.get('solr'),
      }),
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
  getTopics,
};
