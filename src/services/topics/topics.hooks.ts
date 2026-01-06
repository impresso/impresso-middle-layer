import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams, utils, validate, validateEach } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { filtersToSolrQuery } from '@/hooks/search.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformTopic } from '@/transformers/topic.js'
import { ImpressoApplication } from '@/types.js'
import { eachFilterValidator } from '@/services/search/search.validators.js'
import { transformBaseFind } from '@/transformers/base.js'
import { sanitizeFilters } from '@/hooks/parameters.js'

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
