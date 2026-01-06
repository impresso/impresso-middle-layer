import { default as express, Application, static as staticMiddleware } from '@feathersjs/express'
import { feathers } from '@feathersjs/feathers'
import compress from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import appHooksFactory from '@/app.hooks.js'
import authentication from '@/authentication.js'
import cache from '@/cache.js'
import celery, { init as initCelery } from '@/celery.js'
import channels from '@/channels.js'
import configuration, { Configuration } from '@/configuration.js'
import { init as simpleSolrClient } from '@/internalServices/simpleSolr.js'
import { startupJobs } from '@/jobs/index.js'
import middleware from '@/middleware/index.js'
import errorHandling from '@/middleware/errorHandling.js'
import openApiValidator, { init as initOpenApiValidator } from '@/middleware/openApiValidator.js'
import swagger from '@/middleware/swagger.js'
import transport from '@/middleware/transport.js'
import multer from '@/multer.js'
import redis, { init as initRedis } from '@/redis.js'
import sequelize, { init as initSequelize } from '@/sequelize.js'
import services from '@/services/index.js'
import rateLimiter from '@/services/internal/rateLimiter/redis.js'
import quotaChecker from '@/services/internal/quotaChecker/redis.js'
import media from '@/services/media.js'
import { init as imageProxy } from '@/middleware/imageProxy.js'
import schemas from '@/services/schemas.js'
import { AppServices, ImpressoApplication } from '@/types.js'
import { customJsonMiddleware } from '@/util/express.js'
import queue from '@/internalServices/queue.js'
import queueWorkerManager, { start as startQueueWorkerManager } from '@/internalServices/workerManager.js'

import helmet from 'helmet'
import cookieParser from 'cookie-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// @ts-ignore
const app: ImpressoApplication & Application<AppServices, Configuration> = express(feathers())

// Load app configuration
app.configure(configuration)

app.configure(sequelize)

// configure internal services
app.configure(redis)
app.configure(rateLimiter)
app.configure(quotaChecker)
app.configure(cache)
app.configure(simpleSolrClient)

// Enable security, compression, favicon and body parsing
app.use(helmet())
app.use(compress())
app.use(cookieParser())
app.use(customJsonMiddleware()) // JSON body parser / serializer

// configure local multer service.
app.configure(multer)

// Host the public folder
app.use('/', staticMiddleware(path.join(__dirname, app.get('public') as string)))

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)

// configure express services
app.configure(media)
app.configure(imageProxy)
app.configure(schemas)

// Enable Swagger and API validator if needed
app.configure(swagger)
app.configure(openApiValidator)

// Configure transport (Rest, socket.io)
// NOTE: This must be done **before** registering feathers services
// but **after** all express middleware is configured.
// Registering an express middleware after this point will have no effect.
app.configure(transport)

// Set up our services (see `services/index.ts`)
app.configure(authentication)

// configure celery client task manage if celery config is available
app.configure(celery)
// queue manager (to replace celery eventually)
app.configure(queue)
app.configure(queueWorkerManager)

app.configure(services)

app.configure(
  appHooksFactory(
    [initSequelize, initRedis, initCelery, initOpenApiValidator, startQueueWorkerManager, startupJobs],
    []
  )
)

// part of sockets.io (see transport), but must go after services are defined
// because one of the services is used in the channels.
app.configure(channels)

app.configure(errorHandling)

export default app
