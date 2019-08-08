const lodash = require('lodash');
const Collection = require('../models/collections.model');

const resolveCollections = () => async (context) => {
  let uids = [];
  // collect the uids list based on the different service
  if (context.path === 'search-facets') {
    uids = context.result
      .filter(d => d.type === 'collection')
      .reduce((acc, d) => acc.concat(d.buckets.map(di => di.uid)), []);
  } else {
    throw new Error('context path is not registered to be used with resolveCollections hook');
  }

  if (!uids.length) {
    return;
  }
  // get collections as dictionary
  const index = await Collection.sequelize(context.app.get('sequelizeClient'))
    .findAll({
      where: {
        uid: uids,
      },
    })
    .then(rows => lodash.keyBy(rows.map(r => r.toJSON()), 'uid'))
    .catch((err) => {
      console.error('hook resolveCollections ERROR');
      console.error(err);
    });

  if (context.path === 'search-facets') {
    context.result = context.result.map((d) => {
      if (d.type !== 'collection') {
        return d;
      }
      d.buckets = d.buckets.map((b) => {
        b.item = index[b.uid];
        return b;
      });
      return d;
    });
  }
};

module.exports = { resolveCollections };
