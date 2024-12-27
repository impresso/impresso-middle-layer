import app from './app'
const debug = require('debug')('impresso/index')
const port = app.get('port')
const host = app.get('host')
const { logger } = require('./logger')

process.on('unhandledRejection', reason => {
  // show track
  debug('process@unhandledRejection:', reason.message, 'err:', reason.stack || reason)
})
process.on('uncaughtException', err => {
  debug('process@uncaughtException:', err)
})

async function start() {
  debug(`Server: starting on http://${host}:${port}...`)
  const server = await app
    .listen(port, () => {
      logger.info(`Server listening application started on http://${host}:${port}`)
    })
    .catch(err => {
      logger.error('Server startup error:', err)
      process.exit(1)
    })

  server.on('error', err => {
    debug('server@error:', err)
  })
  server.on('close', () => {
    debug('server@close:', 'server closed')
  })
}
start()
