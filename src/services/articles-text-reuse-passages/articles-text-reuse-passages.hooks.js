const { authenticate } = require('../../hooks/authenticate');
const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    all: [],
    find: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      (context) => {
        if (context.params.query.id) {
          context.params.route.articleId = context.params.query.id;
        }
      },
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      validateWithSchema('services/articles-text-reuse-passages/schema/find/response.json', 'result'),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
