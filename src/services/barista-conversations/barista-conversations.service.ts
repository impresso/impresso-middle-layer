import type { ServiceOptions } from '@feathersjs/feathers'
import type { ImpressoApplication } from '@/types.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams } from '@/hooks/params.js'
import { BaristaConversationsService } from './barista-conversations.class.js'

export default function (app: ImpressoApplication) {
  app.use('/barista-conversations', new BaristaConversationsService(app), {
    events: [],
  } as ServiceOptions)

  app.service('barista-conversations').hooks({
    around: {
      all: [authenticate()],
    },
    before: {
      find: [queryWithCommonParams()],
    },
  })
}
