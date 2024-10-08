const debug = require('debug')('impresso/index')
const app = require('./app')
const port = app.get('port')
const host = app.get('host')

process.on('unhandledRejection', reason => {
  // show track
  debug('process@unhandledRejection:', reason.message, 'err:', reason.stack || reason)
})
process.on('uncaughtException', err => {
  debug('process@uncaughtException:', err)
})

async function start() {
  debug(`Server: starting on http://${host}:${port}...`)
  const server = await app.listen(port, () => {
    debug(`Server @listening application started on http://${host}:${port}`)
  })

  server.on('error', err => {
    debug('server@error:', err)
  })
  server.on('close', () => {
    debug('server@close:', 'server closed')
  })
}
start()
