import { createApp } from './app'
import { logger } from './logger'

process.on('unhandledRejection', (error: Error) => {
  logger.error('unhandledRejection', error)
})
process.on('uncaughtException', (err: Error) => {
  logger.error('uncaughtException', err)
})

const start = async () => {
  // Wait for app to be fully configured
  const app = await createApp()
  const [host = 'localhost', port = 8080] = [app.get('host'), app.get('port')]

  const server = await app
    .listen(port, host, () => {
      logger.info(`Application server listening on http://${host}:${port}`)
    })
    .catch(err => {
      logger.error('Server startup error:', err)
      process.exit(1)
    })

  server.on('error', err => {
    logger.error('Server error', err)
  })
  server.on('close', () => {
    logger.error('Server closed')
  })
}

start()
