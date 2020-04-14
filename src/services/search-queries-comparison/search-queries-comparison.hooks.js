const { protect } = require('@feathersjs/authentication-local').hooks;
const { authenticate } = require('../../hooks/authenticate');
const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    create: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validateWithSchema('services/search-queries-comparison/schema/post/payload.json')
    ],
  },

  after: {
    create: [
      protect('content'),
    ],
  },
};
