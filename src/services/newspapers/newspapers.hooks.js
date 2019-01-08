const { queryWithCommonParams, validate, utils } = require('../../hooks/params');

module.exports = {
  before: {
    all: [

    ],
    find: [
      validate({
        q: {
          required: false,
          max_length: 500,
          transform: d => utils.toSequelizeLike(d),
        },
        order_by: {
          choices: ['-name', 'name', '-startYear', 'startYear', '-endYear', 'endYear'],
          defaultValue: 'name',
          transform: d => utils.translate(d, {
            name: [['name', 'ASC']],
            '-name': [['name', 'DESC']],
            startYear: [['startYear', 'ASC']],
            '-startYear': [['startYear', 'DESC']],
            endYear: [['endYear', 'ASC']],
            '-endYear': [['endYear', 'DESC']],
          }),
        },
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
