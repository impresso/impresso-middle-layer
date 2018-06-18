// Initializes the `entities` service on path `/entities`
const createService = require('../neo4j.service');
const hooks = require('./entities.hooks');
const queries = require('decypher')(`${__dirname}/entities.queries.cyp`);


module.exports = function () {
  const app = this;
  const paginate = app.get('paginate');

  const options = {
    name: 'entities',
    paginate,
    config: app.get('neo4j'),
    queries,
  };

  // follow guideline at
  // https://docs.feathersjs.com/faq/readme.html#how-do-i-create-custom-methods
  // app.use('/entities/:entityId/timeline', app.service('timeline'))
  //
  // // change cypher query. That's simple ;)
  // // cfr. entities/queries.cyp
  // app.service('/entities/:entityId/timeline').hooks({
  //   before: {
  //     all(context) {
  //       context.params.query.uid   = context.params.route.entityId;
  //       context.params.query.label = 'entity'
  //     }
  //   }
  // })


  // Initialize our service with any options it requires
  app.use('/entities', createService(options));
  app.use('/entities/:uid/timeline', {
    find(params) {
      return this.app.service('timeline').find({
        query: {
          label: 'entity',
          uid: params.route.uid,
        },
      });
    },
    setup(app) {
      this.app = app;
    },
  });
  // Get our initialized service so that we can register hooks and filters
  const service = app.service('entities');

  service.hooks(hooks);
};
