const {
  queryWithCommonParams, validate, validateEach, utils,
} = require('../../hooks/params');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');
const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    all: [
      checkCachedContents({
        useAuthenticatedUser: false,
      }),
    ],
    find: [
      validateWithSchema('services/newspapers/schema/find/query.json', 'params.query'),
      validate({
        q: {
          required: false,
          max_length: 500,
          transform: d => utils.toSequelizeLike(d),
        },
        order_by: {
          choices: [
            '-name',
            'name',
            '-startYear',
            'startYear', '-endYear',
            'endYear',
            'firstIssue', '-firstIssue',
            'lastIssue', '-lastIssue',
            'countIssues', '-countIssues',
          ],
          defaultValue: 'name',
          transform: d => utils.translate(d, {
            name: [['name', 'ASC']],
            '-name': [['name', 'DESC']],
            startYear: [['startYear', 'ASC']],
            '-startYear': [['startYear', 'DESC']],
            endYear: [['endYear', 'ASC']],
            '-endYear': [['endYear', 'DESC']],
            firstIssue: [['stats', 'startYear', 'ASC']],
            '-firstIssue': [['stats', 'startYear', 'DESC']],
            lastIssue: [['stats', 'endYear', 'ASC']],
            '-lastIssue': [['stats', 'endYear', 'DESC']],
            countIssues: [['stats', 'number_issues', 'ASC']],
            '-countIssues': [['stats', 'number_issues', 'DESC']],
          }),
        },
      }),
      validateEach('filters', {
        type: {
          choices: ['included', 'excluded'],
          required: true,
        },
      }, {
        required: false,
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [
      returnCachedContents(),
      saveResultsInCache(),
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
