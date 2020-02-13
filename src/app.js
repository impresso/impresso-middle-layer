const path = require('path');
const favicon = require('serve-favicon');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const configuration = require('@feathersjs/configuration');
const rest = require('@feathersjs/express/rest');
const socketio = require('@feathersjs/socketio');

// const handler = require('@feathersjs/express/errors');
const notFound = require('feathers-errors/not-found');

const middleware = require('./middleware');
const services = require('./services');
const appHooks = require('./app.hooks');

const authentication = require('./authentication');

const sequelize = require('./sequelize');
const solr = require('./solr');
const neo4j = require('./neo4j');
const redis = require('./redis');
const celery = require('./celery');
const channels = require('./channels');
const multer = require('./multer');
const cache = require('./cache');
const cachedSolr = require('./cachedSolr');

const app = express(feathers());

// Load app configuration
app.configure(configuration());
// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', express.static(app.get('public')));

app.configure(rest());
app.configure(socketio());

// configure database adapters
app.configure(sequelize);
app.configure(solr);
app.configure(neo4j);

// configure redis cahce if redis config is available
app.configure(redis);
// configure local multer service.
app.configure(multer);

app.set('cacheManager', cache(
  app.get('redis'),
  app.get('cache').enabled,
  (error) => {
    console.error('Cache error. Restarting', error.stack);
    process.exit(1);
  },
));
app.set('cachedSolr', cachedSolr(app));

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
app.configure(authentication);
// Set up our services (see `services/index.js`)
app.configure(services);
// configure channels
app.configure(channels);
// configure celery client task manage if celery config is available
app.configure(celery);


// Configure a middleware for 404s and the error handler
app.use(notFound());

// app.configure(handler({
//   // html: {
//   //   // strings should point to html files
//   //   404: 'path/to/custom-404.html',
//   //   default: 'path/to/generic/error-page.html'
//   // },
//   json: {
//     404: (err, req, res, next) => {
//       // make sure to strip off the stack trace in production
//       if (process.env.NODE_ENV === 'production') {
//         delete err.stack;
//       }
//       res.json({ message: 'Not found' });
//     },
//     default: (err, req, res, next) => {
//       // handle all other errors
//       res.json({ message: 'Oh no! Something went wrong' });
//     }
//   }
// }));
//
app.use(express.errorHandler({
  json: {
    404: (err, req, res) => {
      // make sure to strip off the stack trace in production
      if (process.env.NODE_ENV === 'production') {
        delete err.stack;
      } else {
        console.error('error 404 Not found', err);
      }
      res.json({ message: 'Not found' });
    },
    500: (err, req, res) => {
      if (process.env.NODE_ENV === 'production') {
        delete err.stack;
      } else {
        console.error('error 500', err);
      }
      res.json({ message: 'service unavailable' });
    },
    // unauthentified
    401: (err, req, res) => {
      if (process.env.NODE_ENV === 'production') {
        delete err.stack;
      } else {
        console.error('error 401 Not authentified', err);
      }
      res.json({
        message: err.message,
        name: err.name,
        code: err.code,
      });
    },
    // bad request
    400: (err, req, res) => {
      if (process.env.NODE_ENV === 'production') {
        delete err.stack;
      } else {
        console.error('error 400 Bad Request', err.data || err);
      }
      res.json({
        message: err.message || 'Please check request params',
        name: err.name,
        code: err.code,
        errors: err.data,
      });
    },
    default: (err, req, res) => {
      // handle all other errors
      console.error('error', err);
      delete err.stack;
      res.json({ message: err.message });
    },
  },
}));
app.configure(appHooks);

module.exports = app;
