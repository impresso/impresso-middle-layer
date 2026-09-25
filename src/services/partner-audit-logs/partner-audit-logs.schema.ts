import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses } from '@/util/openapi.js'

export const getDocs = (): ServiceSwaggerOptions => {
  const standardResponses = getStandardResponses({ method: 'get', schema: 'Error' })
  return {
    description: 'Partner audit logs',
    securities: ['get'],
    operations: {
      get: {
        operationId: 'getPartnerAuditLogs',
        description:
          'Download the content item access log of a data provider for a single month as a zip archive of ' +
          'the Parquet objects written by the audit log pipeline. Requires authentication.',
        parameters: [
          ...getStandardParameters({ method: 'get' }),
          {
            in: 'query',
            name: 'year',
            required: true,
            schema: { type: 'integer', minimum: 1970, maximum: 2100 },
            description: 'Year of the access log',
          },
          {
            in: 'query',
            name: 'month',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 12 },
            description: 'Month of the access log (1-12)',
          },
        ],
        responses: {
          ...standardResponses,
          200: {
            description: 'The access log of the provider for the requested month as a zip archive of Parquet files',
            headers: {
              'Content-Disposition': {
                schema: { type: 'string' },
                description: 'Attachment file name of the zip download',
              },
            },
            content: {
              'application/zip': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
  }
}
