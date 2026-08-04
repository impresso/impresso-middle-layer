import { logger } from '@/logger.js'
import { AuditLoggingConfig } from '@/models/generated/app/configuration.js'
import { ImpressoApplication } from '@/types.js'
import { ensureServiceIsFeathersCompatible } from '@/util/feathers.js'
import { createFetchClient } from '@/utils/http/client/index.js'

const DefaultHost = 'localhost'
const DefaultPort = 18080

export type AccessMethod = 'web' | 'api'

export interface ContentItemAccessLogEntry {
  providerId: string
  impressoUserId: string
  contentItemId: string
  accessMethod: AccessMethod
  /** Defaults to now if not provided */
  timestamp?: Date
}

interface VectorContentItemAccessLogRecord {
  provider_id: string
  impresso_user_id: string
  content_item_id: string
  timestamp: string
  access_method: AccessMethod
}

export interface VectorLogService {
  logContentItemAccess(entry: ContentItemAccessLogEntry): Promise<void>
}

export class DefaultVectorLogService implements VectorLogService {
  private readonly endpoint: string
  private readonly enabled: boolean
  private readonly client = createFetchClient({})

  constructor(options: AuditLoggingConfig) {
    this.endpoint = `http://${options.host ?? DefaultHost}:${options.port ?? DefaultPort}`
    this.enabled = options.enabled ?? true
  }

  async logContentItemAccess(entry: ContentItemAccessLogEntry): Promise<void> {
    if (!this.enabled) return

    const record: VectorContentItemAccessLogRecord = {
      provider_id: entry.providerId,
      impresso_user_id: entry.impressoUserId,
      content_item_id: entry.contentItemId,
      timestamp: (entry.timestamp ?? new Date()).toISOString(),
      access_method: entry.accessMethod,
    }

    try {
      const response = await this.client.fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      if (!response.ok) {
        logger.warn(`VectorLogService: failed to send log entry (${response.status} ${response.statusText})`)
      }
    } catch (error) {
      logger.warn('VectorLogService: error sending log entry to Vector', { error })
    }
  }
}

export const getVectorLogService = (app: ImpressoApplication): VectorLogService => {
  const service = app.service('vectorLogService') as unknown as VectorLogService
  if (!service) {
    throw new Error('Vector log service not initialized. Make sure to configure it first.')
  }
  return service
}

export const init = (app: ImpressoApplication) => {
  const auditLoggingConfig = app.get('auditLogging') ?? {}

  const service = new DefaultVectorLogService(auditLoggingConfig)

  app.use('vectorLogService', ensureServiceIsFeathersCompatible(service), {
    methods: [],
  })

  logger.info(
    `Vector log service initialized (${auditLoggingConfig.host ?? DefaultHost}:${auditLoggingConfig.port ?? DefaultPort})`
  )
}

export default init
