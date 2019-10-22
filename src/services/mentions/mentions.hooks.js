const {
  queryWithCommonParams, validate, validateEach, utils, REGEX_UIDS,
} = require('../../hooks/params');
const { filtersToSequelizeQuery } = require('../../hooks/sequelize');
const { resolveArticles } = require('../../hooks/resolvers/mentions.resolvers');

const filtersValidator = {
  context: {
    choices: ['include', 'exclude'],
    defaultValue: 'include',
  },
  op: {
    choices: ['AND', 'OR'],
    defaultValue: 'OR',
  },
  type: {
    choices: ['entity'],
    required: true,
  },
  q: {
    required: false,
    regex: REGEX_UIDS,
    max_length: 500,
  },
};


module.exports = {
  before: {
    all: [],
    find: [
      validate({
        faster: {
          required: false,
          transform: d => !!d,
        },
        order_by: {
          choices: ['-name', 'name', '-id', 'id'],
          defaultValue: 'id',
          transform: d => utils.translate(d, {
            // name: [['entity_id', 'ASC'], ['name', 'ASC']],
            // '-name': [['entity_id', 'ASC'], ['name', 'DESC']],
            id: [['id', 'ASC']],
            '-id': [['id', 'DESC']],
          }),
        },
      }, 'GET'),
      validateEach('filters', filtersValidator, {
        required: false,
      }),
      filtersToSequelizeQuery(),
      queryWithCommonParams(),
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
      resolveArticles(),
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
