import express, { Application, static as staticMiddleware } from '@feathersjs/express'
import { feathers } from '@feathersjs/feathers'
import compress from 'compression'
import path from 'path'
import appHooksFactory from './app.hooks'
import authentication from './authentication'
import cache from './cache'
import celery, { init as initCelery } from './celery'
import channels from './channels'
import configuration, { Configuration } from './configuration'
import { init as simpleSolrClient } from './internalServices/simpleSolr'
import { startupJobs } from './jobs'
import middleware from './middleware'
import errorHandling from './middleware/errorHandling'
import openApiValidator, { init as initOpenApiValidator } from './middleware/openApiValidator'
import swagger from './middleware/swagger'
import transport from './middleware/transport'
import multer from './multer'
import redis, { init as initRedis } from './redis'
import sequelize from './sequelize'
import services from './services'
import rateLimiter from './services/internal/rateLimiter/redis'
import media from './services/media'
// import imageProxyv1 from './services/proxy'
import { init as imageProxy } from './middleware/imageProxy'
import schemas from './services/schemas'
import { AppServices, ImpressoApplication } from './types'
import { customJsonMiddleware } from './util/express'

const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const app: ImpressoApplication & Application<AppServices, Configuration> = express(feathers())

// Load app configuration
app.configure(configuration)

// configure internal services
app.configure(sequelize)
app.configure(redis)
app.configure(rateLimiter)
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

// configure celery client task manage if celery config is available
app.configure(celery)

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
app.configure(services)

app.configure(appHooksFactory([initRedis, initCelery, initOpenApiValidator, startupJobs], []))

// part of sockets.io (see transport), but must go after services are defined
// because one of the services is used in the channels.
app.configure(channels)

app.configure(errorHandling)

export default app
