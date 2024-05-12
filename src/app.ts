import { feathers } from '@feathersjs/feathers'
import celery from './celery'
import configuration from './configuration'
import errorHandling from './middleware/errorHandling'
import openApiValidator, { init as initOpenApiValidator } from './middleware/openApiValidator'
import swagger from './middleware/swagger'
import transport from './middleware/transport'
import redis from './redis'
import sequelize from './sequelize'
import services from './services'
import rateLimiter from './services/internal/rateLimiter/redis'
import media from './services/media'
import proxy from './services/proxy'
import schemas from './services/schemas'
import solr from './solr'
import { ensureServiceIsFeathersCompatible } from './util/feathers'

const path = require('path')
const compress = require('compression')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const express = require('@feathersjs/express')

const middleware = require('./middleware')
// const services = require('./services');
const appHooks = require('./app.hooks')

const authentication = require('./authentication')

const channels = require('./channels')
const multer = require('./multer')
const cache = require('./cache')
const cachedSolr = require('./cachedSolr')

const app = express(feathers())

// Load app configuration
app.configure(configuration())

// configure internal services
app.configure(sequelize)
app.configure(solr)
app.configure(redis)
app.configure(rateLimiter)

app.set(
  'cacheManager',
  cache(app.get('redis'), app.get('cache').enabled, (error: Error) => {
    console.error('Cache error. Restarting', error.stack)
    process.exit(1)
  })
)

app.use('cachedSolr', ensureServiceIsFeathersCompatible(cachedSolr(app)), {
  methods: [],
})

// Enable security, compression, favicon and body parsing
app.use(helmet())
app.use(compress())
app.use(cookieParser())

// configure local multer service.
app.configure(multer)

// Host the public folder
app.use('/', express.static(path.join(__dirname, app.get('public'))))

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)
// configure channels
app.configure(channels)
// configure celery client task manage if celery config is available
app.configure(celery)

app.configure(appHooks)

// configure express services
app.configure(media)
app.configure(proxy)
app.configure(schemas)

app.configure(errorHandling)

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

app.hooks({
  setup: [initOpenApiValidator],
})

module.exports = app
