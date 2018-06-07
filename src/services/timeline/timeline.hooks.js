const { validate, REGEX_UID } = require('../../hooks/params');
const { normalizeTimeline } = require('../../hooks/neo4j');

module.exports = {
  before: {
    all: [
      validate({
        // request must contain a label - from which we will create a UID
        using: {
          required: true,
          choices: [
            'article',
            'newspaper_issues_by_year',
            'newspaper_articles_by_year',
            'entity',
          ],
        },
        uid: {
          required: true,
          regex: REGEX_UID,
        },
      }),
    ], // authenticate('jwt') ],
    find: [

    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [
      normalizeTimeline(),
    ],
    find: [],
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
