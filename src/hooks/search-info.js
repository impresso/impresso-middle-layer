const debug = require('debug')('impresso/hooks:facets');

const Newspaper = require('../models/newspapers.model');
const Topic = require('../models/topics.model');

const resolveFacets = () => async(context) => {
  if(context.result && context.result.info && context.result.info.facets) {
    // enrich facets
    if(context.result.info.facets.newspaper) {
      debug('resolveFacets for newspaper');
      context.result.info.facets.newspaper.buckets = context.result.info.facets.newspaper.buckets.map(d => ({
        ...d,
        item: Newspaper.getCached(d.val),
        uid: d.val,
      }));
    }

    if(context.result.info.facets.topic) {
      debug('resolveFacets for topics');
      context.result.info.facets.topic.buckets = context.result.info.facets.newspaper.buckets.map(d => ({
        ...d,
        item: Topic.getCached(d.val),
        uid: d.val,
      }));
    }
  }
}


const resolveQueryComponents = () => async (context) => {
  debug('resolveQueryComponents', context.params.sanitized.queryComponents);
  for(let i = 0, l=context.params.sanitized.queryComponents.length; i < l; i += 1) {
    const d = {
      ...context.params.sanitized.queryComponents[i],
    };
    console.log(d);
    if (d.type === 'newspaper') {
      if (!Array.isArray(d.q)) {
        d.item = Newspaper.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Newspaper.getCached(uid));
      }
    } else if (d.type === 'topic') {
      if (!Array.isArray(d.q)) {
        d.item = Topic.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Topic.getCached(uid));
      }
    } else if (d.type === 'collection') {
      d.items = await context.app.service('collections').find({
        user: context.params.user,
        query: {
          uids: d.q,
        },
      }).then(res => res.data);
    }
    context.params.sanitized.queryComponents[i] = d;
  }
};

module.exports = {
  resolveFacets,
  resolveQueryComponents,
}
