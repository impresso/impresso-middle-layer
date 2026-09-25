import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { logger } from '@/logger.js'
import type { AuditLoggingConfig } from '@/models/generated/app/configuration.js'
import { ImpressoApplication } from '@/types.js'
import { ensureServiceIsFeathersCompatible } from '@/util/feathers.js'

const DefaultRegion = 'us-east-1'
const DefaultKeyPrefix = 'audit-logs'

/**
 * Builds the object key prefix holding all audit log Parquet objects
 * of a provider for the given year and month.
 *
 * The Vector S3 sink writes one object per batch under
 * `<keyPrefix>/<provider_id>/<YYYY>-<MM>-<DD>/<timestamp>-<uuid>.parquet`
 * (see `extra/audit_log/vector.toml`; the configured key prefix includes
 * any environment tag segment, e.g. `audit-logs/prod`), so selecting the
 * whole month amounts to matching the `YYYY-MM-` prefix.
 */
export const getYearMonthKeyPrefix = (
  keyPrefix: string,
  providerId: string,
  year: number,
  month: number
): string => {
  const monthNumber = String(month).padStart(2, '0')
  const cleanKeyPrefix = keyPrefix.replace(/^\/+|\/+$/g, '')
  return `${cleanKeyPrefix}/${providerId}/${year}-${monthNumber}-`
}

/**
 * Read-only access to the audit log objects written to an S3-compatible
 * storage (e.g. MinIO) by the Vector audit log sink.
 */
export interface AuditLogStorage {
  /**
   * List the object keys of a provider's audit logs for the given year-month.
   */
  listYearMonthKeys(providerId: string, year: number, month: number): Promise<string[]>
  /**
   * Download a single audit log object.
   */
  getObject(key: string): Promise<Uint8Array>
}

export class DefaultAuditLogStorage implements AuditLogStorage {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly keyPrefix: string

  constructor(options: NonNullable<AuditLoggingConfig['storage']>) {
    this.bucket = options.bucket
    this.keyPrefix = options.keyPrefix ?? DefaultKeyPrefix
    this.client = new S3Client({
      region: options.region ?? DefaultRegion,
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // MinIO and other S3-compatible stores use path-style addressing,
      // mirroring `force_path_style = true` of the Vector S3 sink.
      forcePathStyle: true,
    })
  }

  async listYearMonthKeys(providerId: string, year: number, month: number): Promise<string[]> {
    const prefix = getYearMonthKeyPrefix(this.keyPrefix, providerId, year, month)
    const keys: string[] = []
    let continuationToken: string | undefined

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      )
      for (const object of response.Contents ?? []) {
        if (object.Key != null) keys.push(object.Key)
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken != null)

    return keys
  }

  async getObject(key: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    )
    if (response.Body == null) {
      throw new Error(`Audit log object ${key} returned an empty response body`)
    }
    return response.Body.transformToByteArray()
  }
}

const isAuditLogStorage = (service: unknown): service is AuditLogStorage =>
  typeof service === 'object' &&
  service !== null &&
  typeof (service as AuditLogStorage).listYearMonthKeys === 'function' &&
  typeof (service as AuditLogStorage).getObject === 'function'

export const getAuditLogStorage = (app: ImpressoApplication): AuditLogStorage => {
  const service = app.service('auditLogStorage')
  if (!isAuditLogStorage(service)) {
    throw new Error('Audit log storage service not initialized. Make sure to configure `auditLogging.storage` first.')
  }
  return service
}

export const init = (app: ImpressoApplication) => {
  const storageConfig = app.get('auditLogging')?.storage

  if (storageConfig == null) {
    logger.warn('Audit log storage is not configured (`auditLogging.storage`), partner audit logs are unavailable.')
    return
  }

  app.use('auditLogStorage', ensureServiceIsFeathersCompatible(new DefaultAuditLogStorage(storageConfig)), {
    methods: [],
  })

  logger.info(`Audit log storage initialized (bucket: ${storageConfig.bucket}, endpoint: ${storageConfig.endpoint})`)
}

export default init
