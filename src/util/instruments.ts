import { logger } from '@/logger.js'

export async function measureTime<T>(fn: () => Promise<T>, label: string, doLog = undefined) {
  const hrstart = process.hrtime()
  const onEnd = () => {
    const hrend = process.hrtime(hrstart)
    const ms = hrend[0] * 1000 + hrend[1] / 1e6
    const print = doLog != null ? doLog : process.env.LOG_TIMING === '1'

    if (print) {
      logger.info(`⏱: "${label}" took ${ms.toFixed(2)} ms.`)
    }
  }
  return fn()
    .then(x => {
      onEnd()
      return x
    })
    .catch(e => {
      onEnd()
      throw e
    })
}
