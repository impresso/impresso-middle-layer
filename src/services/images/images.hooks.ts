import { ApplicationHookOptions } from '@feathersjs/feathers'
import { inPublicApi, inWebAppApi } from '../../hooks/appMode'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { sanitizeFilters } from '../../hooks/parameters'
import { rateLimit } from '../../hooks/rateLimiter'
import { redactResponse, redactResponseDataItem, unlessHasPermission } from '../../hooks/redaction'
import { ImpressoApplication } from '../../types'
import { RedactionPolicy } from '../../util/redaction'
import { loadYamlFile } from '../../util/yaml'

export const imageRedactionPolicy: RedactionPolicy = loadYamlFile(`${__dirname}/resources/imageRedactionPolicy.yml`)

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    find: [sanitizeFilters('filters')],
  },
  after: {
    find: [
      ...inPublicApi([redactResponseDataItem(imageRedactionPolicy, unlessHasPermission('getTranscript'))]),
      ...inWebAppApi([redactResponseDataItem(imageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
    get: [
      ...inPublicApi([redactResponse(imageRedactionPolicy, unlessHasPermission('getTranscript'))]),
      ...inWebAppApi([redactResponse(imageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
  },
} satisfies ApplicationHookOptions<ImpressoApplication>
