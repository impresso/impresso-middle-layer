import { default as express, Application } from '@feathersjs/express'
import { AppServices, ImpressoApplication } from '@/types.js'
import configuration, { Configuration } from '@/configuration.js'
import { initLogger } from '@/logger.js'
import { feathers } from '@feathersjs/feathers'

/**
 * Keeping the basics here with the logger to make sure no other services started
 * logging before import.
 */
export const createApp = (): ImpressoApplication & Application<AppServices, Configuration> => {
  // @ts-ignore
  const app: ImpressoApplication & Application<AppServices, Configuration> = express(feathers())
  // Load app configuration
  app.configure(configuration)
  app.configure(initLogger)

  return app
}
