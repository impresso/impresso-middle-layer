const { validateWithSchema } = require('../../hooks/schema');

export default {
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
