import { Filter } from 'impresso-jscommons'
import { queryWithCommonParams, validate, validateEach, utils, ValidationRules } from '../../hooks/params'
import { filtersToSequelizeQuery } from '../../hooks/sequelize'

const filtersValidator: ValidationRules<Filter> = {
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
    regex: /^[A-zÀ-Ÿ0-9_.–,"'$)(-]+[A-zÀ-Ÿ0-9_.,"'$)(-]+$/,
    max_length: 500,
  },
  precision: {
    required: false,
  },
  uids: {
    required: false,
  },
}

export default {
  before: {
    all: [],
    find: [
      validate(
        {
          faster: {
            required: false,
            transform: (d: any) => !!d,
          },
          order_by: {
            choices: ['-name', 'name', '-id', 'id'],
            defaultValue: 'id',
            transform: d => {
              if (typeof d !== 'string') return d
              return utils.translate(d, {
                // name: [['entity_id', 'ASC'], ['name', 'ASC']],
                // '-name': [['entity_id', 'ASC'], ['name', 'DESC']],
                id: [['id', 'ASC']],
                '-id': [['id', 'DESC']],
              })
            },
          },
        },
        'GET'
      ),
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
