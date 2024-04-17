import configuration from './configuration'
import swagger from './middleware/swagger'
import services from './services'
import transport from './middleware/transport'
import errorHandling from './middleware/errorHandling'
import rateLimiter from './services/internal/rateLimiter/redis'
import redis from './redis'
import { feathers } from '@feathersjs/feathers'
import sequelize from './sequelize'
import solr from './solr'
import media from './services/media'
import proxy from './services/proxy'

const path = require('path')
const compress = require('compression')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const express = require('@feathersjs/express')

const middleware = require('./middleware')
// const services = require('./services');
const appHooks = require('./app.hooks')

const authentication = require('./authentication')

const celery = require('./celery')
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

// Enable Swagger if needed
app.configure(swagger)

app.set('cachedSolr', cachedSolr(app))

// Enable security, compression, favicon and body parsing
app.use(helmet())
app.use(compress())
app.use(cookieParser())

// configure local multer service.
app.configure(multer)

// Host the public folder
app.use('/', express.static(path.join(__dirname, app.get('public'))))

app.configure(transport)

// Set up our services (see `services/index.ts`)
app.configure(authentication)
app.configure(services)

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)
// configure channels
app.configure(channels)
// configure celery client task manage if celery config is available
app.configure(celery)

app.configure(errorHandling)
app.configure(appHooks)

// configure express services
app.configure(media)
app.configure(proxy)

module.exports = app
