import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { sanitizeFilters } from '../../hooks/parameters'
import { RedactionPolicy } from '../../util/redaction'
import { loadYamlFile } from '../../util/yaml'
import {
  publicApiTranscriptRedactionCondition,
  redactResponse,
  redactResponseDataItem,
  webAppExploreRedactionCondition,
} from '../../hooks/redaction'

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
      redactResponseDataItem(imageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponseDataItem(imageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
    get: [
      redactResponse(imageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponse(imageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
  },
}
