const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    create: [
      validateWithSchema('services/entities-suggestions/schema/create/payload.json'),
    ],
  },
  after: {
    create: [
      validateWithSchema('services/entities-suggestions/schema/create/response.json', 'result'),
    ],
  },
};
