const lodash = require('lodash');
const debug = require('debug')('impresso/hooks/resolvers:articles');

const Topic = require('../../models/topics.model');

const resolveTopics = () => async (context) => {
  if (!context.result) {
    debug('resolveTopics: no "context.result" found');
  } else if (context.result.data && context.result.data.length) {
    console.log(context.result.data[0]);
  } else if (context.result.topics && context.result.topics.length) {
    debug(`resolveTopics: "context.result.topics" found with ${context.result.topics.length} topics`);
    const solrClient = context.app.get('solrClient');
    debug('resolveTopics: "solrClient"');

    const groups = await solrClient.utils.resolveAsync([{
      Klass: Topic,
      namespace: 'topics',
      items: context.result.topics,
      idField: 'topicUid',
      itemField: 'topic',
    }]);

    context.result.topics = groups[0].items.sort((a, b) => (a.relevance > b.relevance ? -1 : 1));
  }
};

/**
 * [hasCollections description]
 * @param  {Article}  article [description]
 * @param  {User}  user    [description]
 * @return {Boolean}         [description]
 */
const hasCollections = ({ article, user }) => {
  if (!user || !article.collections.length) {
    debug('\'hasCollections\' skip, no user or empty collections');
    return false;
  }
  debug('hasCollections', article.collections.join(','), user.uid);
  return true;
  // skip user detection as it is related to indexing and could be delayed.
  // return article.collections.join(',').indexOf(user.uid) !== -1;
}

const resolveUserAddons = () => async (context) => {
  if (!context.result || !context.params.authenticated) {
    debug('skipping \'resolveUserAddons\', no user has been found or no results');
    return;
  }
  // get article uids
  let uids = [];
  if (Array.isArray(context.result)) {
    uids = context.result.filter(article => hasCollections({ article, user: context.params.user })).map(d => d.uid);
  } else if (context.result.data && context.result.data.length) {
    uids = context.result.data.filter(article => hasCollections({ article, user: context.params.user })).map(d => d.uid);
  } else if (context.result && context.result.uid) {
    if (hasCollections({ article: context.result, user: context.params.user.uid})) {
      uids.push(context.result.uid);
    }
  }
  if (!uids.length) {
    debug(`skipping 'resolveUserAddons' for user: '${context.params.user.uid}', no articles to enrich!`);
    return;
  }
  debug(`'resolveUserAddons' for user: '${context.params.user.uid}' for ${uids.length} articles...`);

  const collectables = await context.app.service('collectable-items').find({
    authenticated: context.params.authenticated,
    user: context.params.user,
    query: {
      resolve: 'collection',
      item_uids: uids,
    },
  });

  const collectablesIndex = lodash.keyBy(collectables.data, 'itemId');

  const mapper = (d) => {
    const collectableItemGroup = collectablesIndex[d.uid];
    if (collectableItemGroup) {
      d.collections = collectableItemGroup.collections;
    }
    return d;
  };

  if (Array.isArray(context.result)) {
    context.result = context.result.map(mapper);
  } else if (context.result.data) {
    context.result.data = context.result.data.map(mapper);
  } else if (context.result) {
    context.result = mapper(context.result);
  }
};

module.exports = {
  resolveTopics,
  resolveUserAddons,
};
