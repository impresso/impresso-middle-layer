import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { v4 } from 'uuid'
import { WordMatch } from '../../models/generated/schemas'

import { queryWithCommonParams, validate } from '../../hooks/params'

export default {
  before: {
    all: [],
    find: [
      validate(
        {
          language_code: {
            choices: ['fr', 'de', 'lb'],
          },
          term: {
            required: true,
            regex: /^[A-zÀ-ÿ'()\s]+$/,
            max_length: 500,
            transform: (d: string) =>
              d
                .replace(/[^A-zÀ-ÿ]/g, ' ')
                .toLowerCase()
                .split(/\s+/)
                .sort((a: string, b: string) => a.length - b.length)
                .pop(),
          },
        },
        'GET'
      ),
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
      (context: HookContext<ImpressoApplication>) => {
        if (Array.isArray(context.result.data)) {
          context.result.data = context.result.data.map((word: string) => {
            return {
              word,
              id: v4(),
              languageCode: context.params.query.language ?? 'fr',
            } satisfies WordMatch
          })
        }
      },
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
}
