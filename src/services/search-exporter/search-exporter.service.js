// Initializes the `exporter` service on path `/exporter`
const createService = require('./search-exporter.class.js');
const hooks = require('./search-exporter.hooks');
const csvStringify = require('csv-stringify');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'search-exporter',
    paginate,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/search-exporter', createService(options), (req, res) => {
    res.type('text/plain');

    csvStringify(res.data.records, {
      delimiter: ';',
      header: res.data.headers,
    }, (err, rows) => {
      res.end(rows);
    });
  });

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('search-exporter');

  service.hooks(hooks);
};
