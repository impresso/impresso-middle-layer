import type { HookContext, HookMap } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { authorizePartnerAuditLogAccess } from '@/services/partner-audit-logs/authorization.js'
import type { PartnerAuditLogsService } from '@/services/partner-audit-logs/partner-audit-logs.class.js'
import type { ImpressoApplication } from '@/types.js'

const authorize = (context: HookContext<ImpressoApplication>) =>
  authorizePartnerAuditLogAccess(context.params?.user, String(context.id))

export default {
  around: {
    all: [authenticate(), rateLimit('partner-audit-logs')],
  },
  before: {
    get: [authorize],
  },
} satisfies HookMap<ImpressoApplication, PartnerAuditLogsService>
