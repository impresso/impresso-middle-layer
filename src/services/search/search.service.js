import { createSwaggerServiceOptions } from 'feathers-swagger';
import { docs } from './search.schema.js';

// Initializes the `search` service on path `/search`
const createService = require('./search.class.js');
const hooks = require('./search.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'search',
    paginate,
    app,
  };

  app.use('/search', createService(options), {
    methods: ['find'],
    docs: createSwaggerServiceOptions({
      schemas: { },
      docs: docs,
    }),
  });

  app.service('search').hooks(hooks);
};
