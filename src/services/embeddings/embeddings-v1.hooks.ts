import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'
import { WordMatch } from '@/models/generated/schemas.js'

import { queryWithCommonParams, validate } from '@/hooks/params.js'
import { v4 } from 'uuid'

interface Params {
  language_code?: 'fr' | 'de' | 'lb'
  term?: string
}

export default {
  before: {
    all: [],
    find: [
      validate<Params>(
        {
          language_code: {
            choices: ['fr', 'de', 'lb'],
          },
          term: {
            required: true,
            regex: /^[A-zÀ-ÿ'()\s]+$/,
            max_length: 500,
            transform: d => {
              const v = Array.isArray(d) ? d.pop() : d
              if (typeof v !== 'string') return v
              return v
                .replace(/[^A-zÀ-ÿ]/g, ' ')
                .toLowerCase()
                .split(/\s+/)
                .sort((a: string, b: string) => a.length - b.length)
                .pop()
            },
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
