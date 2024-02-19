const path = require('path')
const debug = require('debug')('impresso:app')
const compress = require('compression')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const feathers = require('@feathersjs/feathers')
const express = require('@feathersjs/express')
const configuration = require('@feathersjs/configuration')
const socketio = require('@feathersjs/socketio')

const middleware = require('./middleware')
const services = require('./services')
const appHooks = require('./app.hooks')

const authentication = require('./authentication')

const sequelize = require('./sequelize')
const solr = require('./solr')
const redis = require('./redis')
const celery = require('./celery')
const channels = require('./channels')
const multer = require('./multer')
const cache = require('./cache')
const cachedSolr = require('./cachedSolr')

const app = express(feathers())

// Load app configuration
app.configure(configuration())
// Enable CORS, security, compression, favicon and body parsing
app.use(cors())
app.use(helmet())
app.use(compress())
// Turn on JSON parser for REST services
app.use(express.json())
// Turn on URL-encoded parser for REST services
app.use(express.urlencoded({ extended: true }))
// app.use(bodyParser.json())
// app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())
// app.use(favicon(path.join(app.get('public'), 'favicon.ico')))
// Host the public folder
app.use('/', express.static(path.join(__dirname, app.get('public'))))

// configure database adapters
app.configure(sequelize)
app.configure(solr)

// configure redis cahce if redis config is available
app.configure(redis)
// configure local multer service.
app.configure(multer)

app.set(
  'cacheManager',
  cache(app.get('redis'), app.get('cache').enabled, (error) => {
    console.error('Cache error. Restarting', error.stack)
    process.exit(1)
  })
)
app.set('cachedSolr', cachedSolr(app))

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)
app.configure(authentication)
// Set up our services (see `services/index.js`)
app.configure(services)
// configure channels
app.configure(channels)
// configure celery client task manage if celery config is available
app.configure(celery)

app.use(
  express.errorHandler({
    json: {
      404: (err, req, res) => {
        delete err.stack
        res.json({ message: 'Not found' })
      },
      500: (err, req, res) => {
        if (process.env.NODE_ENV === 'production') {
          delete err.stack
        } else {
          console.error('Error [500]', err)
        }
        res.json({ message: 'service unavailable' })
      },
      // unauthentified
      401: (err, req, res) => {
        res.json({
          message: err.message,
          name: err.name,
          code: err.code,
        })
      },
      // bad request
      400: (err, req, res) => {
        if (process.env.NODE_ENV === 'production') {
          delete err.stack
        } else {
          console.error('Error [400]', err.data || err)
        }
        res.json({
          message: err.message || 'Please check request params',
          name: err.name,
          code: err.code,
          errors: err.data,
        })
      },
      default: (err, req, res) => {
        // handle all other errors
        console.error('error', err)
        delete err.stack
        res.json({ message: err.message })
      },
    },
  })
)
app.configure(appHooks)
// Register REST service handler
debug('registering rest handler')
app.configure(
  socketio((io) => {
    debug('registering socketio handler')
    io.on('connection', (socket) => {
      // Do something here
      debug('socket connected')
    })
    io.on('disconnect', (socket) => {
      // Do something here
      debug('socket disconnected')
    })

    // Registering Socket.io middleware
    io.use(function (socket, next) {
      // Exposing a request property to services and hooks
      socket.feathers.referrer = socket.request.referrer
      next()
    })
  })
)
app.configure(express.rest())
module.exports = app
