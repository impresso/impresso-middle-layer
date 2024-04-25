import { Application } from '@feathersjs/express'
import type { Request, Response } from 'express'
import { ImpressoApplication } from '../types'

/**
 * This service is only available in the public API.
 * It serves the JSON schema files from the `schema` directory.
 */
export default (app: ImpressoApplication & Application) => {
  // only in public API
  if (!app.get('isPublicApi')) return

  app.use('/schema/', async (req: Request, res: Response) => {
    const filename = req.path

    // send file from disk
    res.sendFile(filename, {
      root: `${__dirname}/../schema`,
      dotfiles: 'deny',
      headers: { 'Content-Type': 'application/json' },
    })
  })
}
