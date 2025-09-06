import { hooks } from '@feathersjs/authentication'
const { queryWithCommonParams, validate, utils } = require('../../hooks/params')

const { authenticate } = hooks

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate({
        order_by: {
          choices: ['-created', 'created', '-modified', 'modified'],
          defaultValue: '-modified',
          transform: d =>
            utils.translate(d, {
              modified: [['date_last_modified', 'ASC']],
              '-modified': [['date_last_modified', 'DESC']],
              created: [['date_created', 'ASC']],
              '-created': [['date_created', 'DESC']],
            }),
        },
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [
      validate(
        {
          status: {
            choices: ['stop'],
            defaultValue: '-modified',
            transform: d =>
              utils.translate(d, {
                stop: 'STO',
              }),
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
}
