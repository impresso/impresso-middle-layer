import { createReadStream } from 'node:fs'
import type { NextFunction, Request, Response } from 'express'
import type { ServiceOptions } from '@feathersjs/feathers'
import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import {
  PartnerAuditLogsService,
  type PartnerAuditLogArchive,
} from '@/services/partner-audit-logs/partner-audit-logs.class.js'
import { rmArchiveQuietly } from '@/services/partner-audit-logs/auditLogArchive.js'
import hooks from '@/services/partner-audit-logs/partner-audit-logs.hooks.js'
import { getDocs } from '@/services/partner-audit-logs/partner-audit-logs.schema.js'
import type { ImpressoApplication } from '@/types.js'

const isPartnerAuditLogArchive = (value: unknown): value is PartnerAuditLogArchive =>
  typeof value === 'object' &&
  value !== null &&
  'archivePath' in value &&
  typeof value.archivePath === 'string' &&
  'filename' in value &&
  typeof value.filename === 'string'

const sendArchiveResponse = (_req: Request, res: Response, next: NextFunction) => {
  const result: unknown = res.data
  if (!isPartnerAuditLogArchive(result)) return next()

  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', `attachment; filename="${result.filename}"`)

  const archiveStream = createReadStream(result.archivePath)
  // Remove the temporary archive once it has been fully sent (or aborted)
  archiveStream.on('close', () => rmArchiveQuietly(result.archivePath))
  archiveStream.on('error', error => next(error))
  archiveStream.pipe(res)
}

/**
 * Content item access log downloads for data providers.
 *
 * The service is available in both the internal and the public API, but in
 * the public API it must not appear in swagger.json. Simply omitting the
 * `docs` option is not enough: feathers-swagger would auto-generate a spec
 * entry referencing a non-existent `partner-audit-logs` component schema
 * and break the OpenAPI validation at startup. The explicit
 * `operations: { get: false }` suppresses the generated entry instead.
 */
export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  const hideFromSwagger = true // flip in dev if needed

  const docs: ServiceSwaggerOptions =
    isPublicApi && hideFromSwagger
      ? { operations: { get: false } }
      : createSwaggerServiceOptions({ schemas: {}, docs: getDocs() })

  app.use('/partner-audit-logs', new PartnerAuditLogsService(app), {
    events: [],
    express: { after: [sendArchiveResponse] },
    docs,
  } as ServiceOptions)

  app.service('partner-audit-logs').hooks(hooks)
}
