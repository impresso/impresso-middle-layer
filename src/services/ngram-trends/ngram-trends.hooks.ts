import { get } from 'lodash-es'
import { BadRequest } from '@feathersjs/errors'
import { authenticate } from '@/hooks/authenticate.js'
import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'
import { HookContext } from '@feathersjs/feathers'
import { Filter } from 'impresso-jscommons'

const validationInstance = newAjvInstance([
  ['schema/canonical/Filter.json', 'schema/canonical/Filter.json'],
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
 * Create validator function that fails validation if one or more multigrams
 * are not unigrams.
 *
 * This method is here temporarily until we start supporting multigrams.
 * @param {string} fieldPath path to the field of `context` that contains ngrams (doted notation)
 *
 * @return {object} context
 */
const ensureUnigrams = (fieldPath: string) => (context: HookContext) => {
  const ngrams = get(context, fieldPath) as string[]
  const multigrams = ngrams.filter(ngram => ngram.split(' ').length > 1)
  if (multigrams.length > 0) {
    throw new BadRequest(
      `Only unigrams are supported at the moment. Found multigrams: ${multigrams.map(v => `"${v}"`).join(', ')}`
    )
  }
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
      ensureUnigrams('data.ngrams'),
    ],
  },
  after: {
    create: [validateWithSchema('response', validationInstance, 'result')],
  },
}
