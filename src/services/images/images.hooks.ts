import { ApplicationHookOptions } from '@feathersjs/feathers'
import { inPublicApi, inWebAppApi } from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { sanitizeFilters } from '@/hooks/parameters.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { redactResponse, redactResponseDataItem, unlessHasPermission } from '@/hooks/redaction.js'
import { ImpressoApplication } from '@/types.js'
import { RedactionPolicy } from '@/util/redaction.js'
import { loadYamlFile } from '@/util/yaml.js'

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
