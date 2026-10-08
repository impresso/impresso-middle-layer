import type { ServiceSwaggerOptions } from 'feathers-swagger'
import request from '@/schema/app/requests/ProvenanceVerificationRequest.json' with { type: 'json' }
import response from '@/schema/app/responses/ProvenanceVerificationResponse.json' with { type: 'json' }
import { getRequestBodyContent, getStandardResponses } from '@/util/openapi.js'

export const schemas = {
  ProvenanceVerificationRequest: request,
  ProvenanceVerificationResponse: response,
}
export const docs: ServiceSwaggerOptions = {
  tags: ['Tools'],
  description:
    'Signed delivery receipts identify the receiving account and ordered item IDs, not the publisher or authentic item content. Receipts can be removed or copied. A signed sequence need not be the full search result set.',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'verifyProvenance',
      description:
        'Usually send only { "token": "<receipt>" }. Copy the receipt from meta.provenance.token or X-Impresso-Provenance; authenticate the request with your normal API JWT. This verifies the signature and claims and returns valid and claims (no idsMatch). Optionally supply ID material to compare membership/order only; idsHash compares the supplied digest without examining a dataset, while ids/csv are examined server-side. The embedded CSV receipt is ignored.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            ...getRequestBodyContent('ProvenanceVerificationRequest')['application/json'],
            example: { token: '<paste meta.provenance.token or X-Impresso-Provenance here>' },
          },
        },
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'ProvenanceVerificationResponse',
        standardPagination: false,
      }),
    },
  },
}
