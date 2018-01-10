// Initializes the `entities` service on path `/entities`
const createService = require('../neo4j.service');
const hooks = require('./entities.hooks');
const queries = require('decypher')(__dirname + '/entities.queries.cyp');


module.exports = function () {
  const app = this;
  const paginate = app.get('paginate');

  const options = {
    name: 'entities',
    paginate,
    run: app.get('neo4jSessionRunner'),
    queries: queries
  };

  // follow guideline at
  // https://docs.feathersjs.com/faq/readme.html#how-do-i-create-custom-methods
  app.use('/entities/timeline', app.service('timeline'))
  app.use('/entities/:entityId/timeline', app.service('timeline'))

  // change cypher query. That's simple ;)
  // cfr. entities/queries.cyp
  app.service('/entities/:entityId/timeline').hooks({
    before: {
      all(context) {
        console.log('HOOOOOK ', '/entities/:entityId/timeline')
        context.params.query.uid   = context.params.route.entityId;
        context.params.query.label = 'entity'
      }
    }  
  })

  app.service('/entities/timeline').hooks({
    before: {
      all(context) {
        console.log('HOOOOOK ', '/entities/timeline')
        
        context.params.query.label = 'entities'
      }
    }
  })

  

  // Initialize our service with any options it requires
  app.use('/entities', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('entities');

  service.hooks(hooks);
};
