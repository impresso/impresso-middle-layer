/* eslint-disable no-unused-vars */
const lodash = require('lodash');
const { NotFound } = require('@feathersjs/errors');
const debug = require('debug')('impresso/services:articles-suggestions');
const Article = require('../../models/articles.model');
const ArticleTopic = require('../../models/articles-topics.model');

const SIMILARITY_BY_TOPICS = 'topics';


class Service {
  constructor(options) {
    this.app = options.app;
    this.solrClient = options.app.get('solrClient');
    this.name = options.name;
    this.options = options;
  }

  async get(id, params) {
    if (params.query.method === SIMILARITY_BY_TOPICS) {
      debug(`get(${id}) method: ${params.query.method} load topics ...`);
      const topics = await this.solrClient.findAll({
        q: `id:${id}`,
        fl: 'topics_dpfs',
      })
        .then(res => ArticleTopic.solrDPFsFactory(res.response.docs[0].topics_dpfs))
        .catch((err) => {
          console.error(err);
          throw new NotFound();
        });

      const topicWeight = lodash.take(topics, 3).reduce((acc, d) => {
        acc.push(`abs(sub(${d.relevance},payload(topics_dpfs,${d.topicUid})))`);
        return acc;
      }, []).join(',');

      debug(`get(${id}) method: ${params.query.method} topics loaded, get articles`);
      return this.solrClient.findAll({
        q: 'filter(topics_dpfs:*)',
        // eslint-disable-next-line no-template-curly-in-string
        fl: Article.ARTICLE_SOLR_FL_LITE.concat(['dist:${topicWeight}']),
        vars: {
          topicWeight: `sum(${topicWeight})`,
        },
        skip: params.query.skip,
        limit: params.query.limit,
        // eslint-disable-next-line no-template-curly-in-string
        order_by: '${topicWeight} asc',
      }, Article.solrFactory)
        .then(this.solrClient.utils.wrapAll)
        .catch((err) => {
          console.error(err);
          throw new NotFound();
        });
    }

    return {
      id,
      warning: 'no method defined!',
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
