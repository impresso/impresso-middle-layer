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
import channels from './channels'
import { ImpressoApplication } from './types'
import { Application } from '@feathersjs/express'
import bodyParser from 'body-parser'
import authentication from './authentication'

const path = require('path')
const compress = require('compression')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const express = require('@feathersjs/express')

const middleware = require('./middleware')
// const services = require('./services');
const appHooks = require('./app.hooks')

const multer = require('./multer')
const cache = require('./cache')
const cachedSolr = require('./cachedSolr')

const app: ImpressoApplication & Application = express(feathers())

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
// needed to access body in non-feathers middlewares, like openapi validator
app.use(bodyParser.json({ limit: '50mb' }))

// configure local multer service.
app.configure(multer)

// Host the public folder
app.use('/', express.static(path.join(__dirname, app.get('public'))))

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)

// configure celery client task manage if celery config is available
app.configure(celery)

// configure express services
app.configure(media)
app.configure(proxy)
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

app.hooks({
  setup: [initOpenApiValidator],
})
app.configure(appHooks)

// part of sockets.io (see transport), but must go after services are defined
// because one of the services is used in the channels.
app.configure(channels)

app.configure(errorHandling)

module.exports = app
