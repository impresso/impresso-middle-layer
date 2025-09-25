// Initializes the `exporter` service on path `/exporter`
import csvStringify from 'csv-stringify'
import { Service } from './search-exporter.class'
import hooks from './search-exporter.hooks.js'
import { ImpressoApplication } from '../../types'
import type { Application as ExpressApplication } from '@feathersjs/express'
import type { Request, Response } from 'express'

export default function (app: ImpressoApplication & ExpressApplication) {
  // Initialize our service with any options it requires
  app.use('/search-exporter', new Service(app), (req: Request, res: Response) => {
    res.type('text/plain')

    csvStringify(
      res.data.records,
      {
        delimiter: ';',
        header: res.data.headers,
      },
      (err, rows) => {
        delete err.stack
        res.end(rows)
      }
    )
  })

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('search-exporter')

  service.hooks(hooks)
}
