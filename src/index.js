const debug = require('debug')('impresso/index')
const app = require('./app')
const port = app.get('port')
const host = app.get('host')

debug(`Server: starting on http://${host}:${port}...`)

async function start() {
  const server = await app.listen(port)
  process.on('unhandledRejection', (reason) => {
    // show track
    debug(
      'process@unhandledRejection:',
      reason.message,
      'err:',
      reason.stack || reason
    )
  })
  server.on('listening', () => {
    debug(`server@listening application started on http://${host}:${port}`)
  })
}
start()
