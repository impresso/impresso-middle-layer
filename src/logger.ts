import { configure, getConsoleSink, getLogger, getJsonLinesFormatter } from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'

export const logger = getLogger(['app'])

export const initLogger = async () => {
  const isProd = process.env.NODE_ENV === 'production'

  await configure({
    sinks: {
      console: getConsoleSink({
        // isProd outputs structured JSON. !isProd defaults to pretty terminal output.
        formatter: isProd ? getJsonLinesFormatter() : getPrettyFormatter(),
      }),
    },
    loggers: [{ category: [], sinks: ['console'], lowestLevel: isProd ? 'info' : 'debug' }],
  })
}
