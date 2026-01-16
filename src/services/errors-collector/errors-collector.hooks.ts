import type { HookMap } from '@feathersjs/feathers'
import { AppServices, ImpressoApplication } from '@/types.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
} satisfies HookMap<ImpressoApplication, AppServices>
