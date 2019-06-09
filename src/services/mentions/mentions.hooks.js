const {
  queryWithCommonParams, validate, utils,
} = require('../../hooks/params');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        order_by: {
          choices: ['-name', 'name', '-id', 'id'],
          defaultValue: 'id',
          transform: d => utils.translate(d, {
            name: [['name', 'ASC']],
            '-name': [['name', 'DESC']],
            id: [['id', 'ASC']],
            '-id': [['id', 'DESC']],
          }),
        },
      }, 'GET'),
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
