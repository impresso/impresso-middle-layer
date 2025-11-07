import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '../../hooks/appMode'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams, utils, validate, validateEach } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { filtersToSolrQuery } from '../../hooks/search'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformTopic } from '../../transformers/topic'
import { ImpressoApplication } from '../../types'
import { eachFilterValidator } from '../search/search.validators'
import { transformBaseFind } from '../../transformers/base'
import { sanitizeFilters } from '../../hooks/parameters'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    find: [
      sanitizeFilters('filters'),
      validate({
        q: {
          required: false,
          min_length: 1,
          max_length: 50,
        },
        order_by: utils.orderBy({
          values: {
            name: 'word_probs_dpf ASC',
            '-name': 'word_probs_dpf DESC',
            model: 'tp_model_s ASC',
            '-model': 'tp_model_s DESC',
          },
          defaultValue: 'name',
        }),
      }),
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
      }),
      queryWithCommonParams(),
    ],
  },

  after: {
    find: [...inPublicApi([transformResponse(transformBaseFind), transformResponseDataItem(transformTopic)])],
    get: [...inPublicApi([transformResponse(transformTopic)])],
  },
} as HookOptions<ImpressoApplication, any>
