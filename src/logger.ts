import { AsyncLocalStorage } from 'node:async_hooks'
import { configure, getConsoleSink, getLogger, getJsonLinesFormatter } from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'

export { getLogger, withContext } from '@logtape/logtape'

export const logger = getLogger(['app'])

// Shared async-local storage backing LogTape's withContext(). Must be passed
// to configure() so that withContext() actually propagates properties to logs.
const contextLocalStorage = new AsyncLocalStorage<Record<string, unknown>>()

export const initLogger = async () => {
  const isProd = process.env.NODE_ENV === 'production'

  await configure({
    sinks: {
      console: getConsoleSink({
        // isProd outputs structured JSON. !isProd defaults to pretty terminal output.
        // In dev, enable `properties: true` so the error object (and any other
        // structured properties) are rendered below each log line.
        formatter: isProd
          ? getJsonLinesFormatter()
          : getPrettyFormatter({ properties: true }),
      }),
    },
    contextLocalStorage,
    loggers: [{ category: [], sinks: ['console'], lowestLevel: isProd ? 'info' : 'debug' }],
  })
}
