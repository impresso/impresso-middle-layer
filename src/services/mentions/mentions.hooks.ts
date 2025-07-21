import { queryWithCommonParams, validate, validateEach, utils } from '../../hooks/params'
import { filtersToSequelizeQuery } from '../../hooks/sequelize'

interface FiltersValidator {
  context?: {
    choices: string[]
    defaultValue: string
  }
  op?: {
    choices: string[]
    defaultValue: string
  }
  type: {
    choices: string[]
    required: boolean
  }
  q?: {
    required: boolean
    regex: RegExp
    max_length: number
  }
  [key: string]: any
}

const filtersValidator: FiltersValidator = {
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
            transform: (d: string) =>
              utils.translate(d, {
                // name: [['entity_id', 'ASC'], ['name', 'ASC']],
                // '-name': [['entity_id', 'ASC'], ['name', 'DESC']],
                id: [['id', 'ASC']],
                '-id': [['id', 'DESC']],
              }),
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
