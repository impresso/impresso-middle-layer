import { get, set } from 'lodash-es'
import { BadRequest } from '@feathersjs/errors'
import { authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'
import { HookContext } from '@feathersjs/feathers'
import { Filter } from 'impresso-jscommons'

const validationInstance = newAjvInstance([
  ['schema/app/entities/Filter.json', 'schema/app/entities/Filter.json'],
  ['services/ngram-trends/schema/post/payload.json', 'request'],
  ['services/ngram-trends/schema/post/response.json', 'response'],
])

/**
 * At the moment we are not allowing to filter by full text search queries
 * while getting ngram frequencies.
 */
const ForbiddenFilterTypes = ['string', 'regex']

/**
 * Create validator function that fails validation if one ore more filters
 * with excluded types are present.
 * @param {string} fieldPath path to the field of `context` that contains filters (doted notation)
 * @param {array} excludedTypes types of filters that should not be present
 *
 * @return {object} context
 */
const validateFilterTypes =
  (fieldPath: string, excludedTypes: string[] = []) =>
  (context: HookContext) => {
    const filters = get(context, fieldPath) as Filter[]
    const unexpectedFilters = filters.filter(({ type }) => excludedTypes.includes(type))
    if (unexpectedFilters.length > 0) {
      const unexpectedTypes = unexpectedFilters.map(({ type }) => type)
      throw new BadRequest(`Filters with the following types are not allowed: ${unexpectedTypes.join(', ')}`)
    }
    return context
  }

/**
 * Create hook that trims surrounding whitespace from ngrams and fails validation
 * if one or more of them are empty or are not unigrams. Any whitespace character
 * inside a term (space, tab, newline, non-breaking space) makes it a multigram.
 *
 * This method is here temporarily until we start supporting multigrams.
 * @param {string} fieldPath path to the field of `context` that contains ngrams (doted notation)
 *
 * @return {object} context
 */
export const normalizeUnigrams = (fieldPath: string) => (context: HookContext) => {
  const ngrams = (get(context, fieldPath) as string[]).map(ngram => ngram.trim())
  if (ngrams.some(ngram => ngram.length === 0)) {
    throw new BadRequest('Ngrams must not be empty')
  }
  const multigrams = ngrams.filter(ngram => /\s/.test(ngram))
  if (multigrams.length > 0) {
    throw new BadRequest(
      `Only unigrams are supported at the moment. Found multigrams: ${multigrams.map(v => `"${v}"`).join(', ')}`
    )
  }
  set(context, fieldPath, ngrams)
  return context
}

export default {
  before: {
    create: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validateWithSchema('request', validationInstance),
      validateFilterTypes('data.filters', ForbiddenFilterTypes),
      normalizeUnigrams('data.ngrams'),
    ],
  },
  after: {
    create: [validateWithSchema('response', validationInstance, 'result')],
  },
}
