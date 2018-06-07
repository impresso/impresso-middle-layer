// Initializes the `newspapers` service on path `/newspapers`
const createService = require('./newspapers.class');
// hybrid model
// const createModel = require('../../models/newspapers.model');
const hooks = require('./newspapers.hooks');
// const queries = require('decypher')(__dirname + '/newspapers.queries.cyp');


module.exports = function(app) {

  const paginate = app.get('paginate');

  // sequelize (postgres)
  // const model = createModel(app);

  const options = {
    name: 'newspapers',
    paginate,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/newspapers', createService(options));
  // only if we want to enrich it.
  // app.use('/newspapers/:uid/timeline', {
  //   find(params) {
  //     return this.app.service('timeline').find({
  //       query: {
  //         using: 'newspaper_issues_by_year',
  //         uid: params.route.uid
  //       }
  //     });
  //   },
  //   setup(app) {
  //     this.app = app;
  //   }
  // });

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('newspapers');

  service.hooks(hooks);
};
