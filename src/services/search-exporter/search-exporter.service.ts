// Initializes the `exporter` service on path `/exporter`
import { stringify } from 'csv-stringify/sync'
import { Service } from '@/services/search-exporter/search-exporter.class.js'
import hooks from '@/services/search-exporter/search-exporter.hooks.js'
import { ImpressoApplication } from '@/types.js'
import type { Application as ExpressApplication } from '@feathersjs/express'
import type { Request, Response } from 'express'

export default function (app: ImpressoApplication & ExpressApplication) {
  // Initialize our service with any options it requires
  app.use('/search-exporter', new Service(app), (req: Request, res: Response) => {
    res.type('text/plain')

    const rows = stringify(res.data.records, {
      delimiter: ';',
      header: res.data.headers,
    })
    res.end(rows)
  })

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('search-exporter')

  service.hooks(hooks)
}
