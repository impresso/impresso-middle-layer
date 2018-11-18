// Initializes the `version` service on path `/version`
const { authenticate } = require('@feathersjs/authentication').hooks;
const { exec } = require('child-process-async');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/version', {
    async find() {
      const { stdout, stderr } = await exec('git rev-parse HEAD');
      if (stderr) {
        console.log(stderr);
      }
      return {
        version: typeof stdout === 'string' ? stdout.trim() : 'None',
      };
    },
    // setup(app) {
    //   this.app = app;
    // },
  });

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('version');
  service.hooks({
    before: {
      all: [authenticate('jwt')],
    },
  });
};
