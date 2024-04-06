const { authenticate } = require('@feathersjs/authentication').hooks;
const { queryWithCommonParams, validate, utils, REGEX_UIDS } = require('../../hooks/params');

const { STATUS_PRIVATE, STATUS_PUBLIC } = require('../../models/collections.model');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate({
        uids: {
          required: false,
          regex: REGEX_UIDS,
          transform: d => (Array.isArray(d) ? d : d.split(',')),
        },
        q: {
          required: false,
          max_length: 500,
          transform: d => utils.toSequelizeLike(d),
        },
        order_by: {
          choices: ['-date', 'date', '-size', 'size'],
          defaultValue: '-date',
          transform: d =>
            utils.translate(d, {
              date: [['date_last_modified', 'ASC']],
              '-date': [['date_last_modified', 'DESC']],
              size: [['count_items', 'ASC']],
              '-size': [['count_items', 'DESC']],
            }),
        },
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate(
        {
          // request must contain a name - from which we will create a UID
          name: {
            required: true,
            min_length: 3,
            max_length: 50,
          },
          // optionally
          description: {
            required: false,
            max_length: 500,
          },
          // optionally
          status: {
            required: false,
            choices: [STATUS_PRIVATE, STATUS_PUBLIC],
            defaultValue: STATUS_PRIVATE,
          },
        },
        'POST'
      ),
    ],
    update: [],
    patch: [
      validate(
        {
          // request must contain a name - from which we will create a UID
          name: {
            required: false,
            min_length: 3,
            max_length: 50,
          },
          description: {
            required: false,
            min_length: 0,
            max_length: 500,
          },
        },
        'POST'
      ),
    ],
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
