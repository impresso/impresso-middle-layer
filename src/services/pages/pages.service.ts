import { PagesService as Service } from '@/services/pages/pages.class.js'
import { queryWithCommonParams } from '@/hooks/params.js'
import type { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default async (app: ImpressoApplication) => {
  app.use('/pages', new Service(app), {
    events: [],
  } as ServiceOptions)

  const service = app.service('pages')

  service.hooks({
    before: {
      find: [queryWithCommonParams()],
      get: [queryWithCommonParams()],
    },
  })
}
