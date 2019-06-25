const lodash = require('lodash');
const debug = require('debug')('impresso/hooks/resolvers:mentions');
const Article = require('../../models/articles.model');

/**
 * ResolveArticles by ids
 * @param  {String} [key='articleUid'] [description]
 * @return {[type]}                    [description]
 */
const resolveArticles = (key = 'articleUid') => async (context) => {
  // get article uids from entityMentions
  const uids = context.result.data.map(d => d[key]);
  const solrClient = context.app.get('solrClient');

  debug('"resolveArticles": uids', uids);

  const results = await solrClient.findAll({
    q: `id:(${uids.join(' OR ')})`,
    limit: uids.length,
    skip: 0,
    fl: Article.ARTICLE_SOLR_FL_LITE,
    namespace: 'search',
  }, Article.solrFactory);

  const articles = lodash.keyBy(results.response.docs, 'uid');

  // enrich thanks to uid ordering, then get
  uids.forEach((uid, i) => {
    if (articles[uid]) {
      context.result.data[i].article = articles[uid];
      delete context.result.data[i].article.content;
    }
  });
};

module.exports = {
  resolveArticles,
};
