import { BadRequest, Forbidden } from '@feathersjs/errors'
import type { Id, Params } from '@feathersjs/feathers'
import type { Sequelize } from 'sequelize'
import type { SlimUser } from '@/authentication.js'
import { getAuditLogStorage } from '@/internalServices/auditLogStorage.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { createAuditLogArchive, type PartnerAuditLogArchive } from '@/services/partner-audit-logs/auditLogArchive.js'
import type { ImpressoApplication } from '@/types.js'

const MinYear = 1970
const MaxYear = 2100

export type { PartnerAuditLogArchive }

export interface PartnerAuditLogQuery {
  year?: unknown
  month?: unknown
}

export const parseYearMonth = (query: PartnerAuditLogQuery | undefined): { year: number; month: number } => {
  const year = Number(query?.year)
  const month = Number(query?.month)

  if (!Number.isInteger(year) || year < MinYear || year > MaxYear) {
    throw new BadRequest('Invalid or missing `year` query parameter, expected an integer between 1970 and 2100')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BadRequest('Invalid or missing `month` query parameter, expected an integer between 1 and 12')
  }
  return { year, month }
}

const sanitizeFilenamePart = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, '-')

export class PartnerAuditLogsService {
  private readonly accessModel: ReturnType<typeof SpecialMembershipAccess.initialize>

  constructor(private readonly app: ImpressoApplication) {
    this.accessModel = SpecialMembershipAccess.initialize(app.get('sequelizeClient') as Sequelize)
  }

  /**
   * Download the audit log of a data provider for a single year-month as a
   * zip archive of the Parquet objects written by the Vector sink. The
   * archive is written to a temporary file; when called over HTTP it is
   * streamed to the client and removed afterwards.
   */
  async get(
    id: Id,
    params?: Params & { query?: PartnerAuditLogQuery; user?: SlimUser }
  ): Promise<PartnerAuditLogArchive> {
    const providerId = String(id)
    const { year, month } = parseYearMonth(params?.query)
    const user = params?.user
    const accessPlan = user?.isStaff
      ? true
      : user
        ? await this.accessModel.findOne({
            attributes: ['id'],
            where: { reviewerId: user.id, dataProviderAlias: providerId },
          })
        : null

    if (!accessPlan) throw new Forbidden('User is not authorized to access partner audit logs')

    const storage = getAuditLogStorage(this.app)
    const keys = await storage.listYearMonthKeys(providerId, year, month)
    const filename = `audit-logs-${sanitizeFilenamePart(providerId)}-${year}-${String(month).padStart(2, '0')}.zip`

    return createAuditLogArchive(keys, key => storage.getObject(key), filename)
  }
}
