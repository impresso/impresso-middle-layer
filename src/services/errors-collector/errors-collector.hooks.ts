import type { HookMap } from '@feathersjs/feathers'
import { AppServices, ImpressoApplication } from '../../types'
import { authenticateAround as authenticate } from '../../hooks/authenticate'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
} satisfies HookMap<ImpressoApplication, AppServices>
