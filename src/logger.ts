import { AsyncLocalStorage } from 'node:async_hooks'
import { configureSync, getConsoleSink, getLogger, getJsonLinesFormatter } from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'
import { ImpressoApplication } from './types.js'

export { getLogger, withContext } from '@logtape/logtape'

export const logger = getLogger(['app'])

/**
 * LogTape treats `{...}` in a message as a property placeholder.
 * Escape braces so arbitrary text (JSON, Solr queries) is logged verbatim.
 */
export const escapeLogMessage = (message: string): string => message.replace(/[{}]/g, brace => brace + brace)

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
        // wordWrap is disabled so long values (e.g. Solr queries) stay on one line
        // and can be copied verbatim.
        formatter:
          app.get('logging')?.format === 'pretty'
            ? getPrettyFormatter({ properties: true, wordWrap: false })
            : getJsonLinesFormatter(),
      }),
    },
    contextLocalStorage,
    loggers: [{ category: [], sinks: ['console'], lowestLevel: app.get('logging')?.lowestLevel ?? 'info' }],
  })
}
