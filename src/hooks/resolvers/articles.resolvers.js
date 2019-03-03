const debug = require('debug')('impresso/hooks/resolvers:articles');

const Topic = require('../../models/topics.model');

const resolveTopics = () => async (context) => {
  if(!context.result) {
    debug('resolveTopics: no "context.result" found');
  } else if (context.result.data && context.result.data.length) {
    console.log(context.result.data[0]);
  } else if (context.result.topics && context.result.topics.length) {
    debug(`resolveTopics: "context.result.topics" found with ${context.result.topics.length} topics`);
    const solrClient = context.app.get('solrClient');
    debug(`resolveTopics: "solrClient"`);

    const groups = await solrClient.utils.resolveAsync([{
      Klass: Topic,
      namespace: 'topics',
      items: context.result.topics,
      idField: 'topicUid',
      itemField: 'topic',
    }]);

    context.result.topics = groups[0].items.sort((a,b) => a.relevance > b.relevance? -1: 1);
  }
}

module.exports = {
  resolveTopics,
}
