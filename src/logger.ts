import { AsyncLocalStorage } from 'node:async_hooks'
import { configureSync, getConsoleSink, getLogger, getJsonLinesFormatter } from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'
import { ImpressoApplication } from './types.js'

export { getLogger, withContext } from '@logtape/logtape'

export const logger = getLogger(['app'])

// Shared async-local storage backing LogTape's withContext(). Must be passed
// to configure() so that withContext() actually propagates properties to logs.
const contextLocalStorage = new AsyncLocalStorage<Record<string, unknown>>()

export async function initLogger(app: ImpressoApplication) {
  configureSync({
    sinks: {
      console: getConsoleSink({
        // isProd outputs structured JSON. !isProd defaults to pretty terminal output.
        // In dev, enable `properties: true` so the error object (and any other
        // structured properties) are rendered below each log line.
        formatter:
          app.get('logging')?.format === 'pretty' ? getPrettyFormatter({ properties: true }) : getJsonLinesFormatter(),
      }),
    },
    contextLocalStorage,
    loggers: [{ category: [], sinks: ['console'], lowestLevel: app.get('logging')?.lowestLevel ?? 'info' }],
  })
}
