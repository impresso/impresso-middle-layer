import type { HookMap } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import type { PartnerAuditLogsService } from '@/services/partner-audit-logs/partner-audit-logs.class.js'
import type { ImpressoApplication } from '@/types.js'

export default {
  around: {
    all: [authenticate(), rateLimit('partner-audit-logs')],
  },
} satisfies HookMap<ImpressoApplication, PartnerAuditLogsService>
