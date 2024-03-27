import configuration from './configuration';
import swagger from './middleware/swagger';
import services from './services';
import transport from './middleware/transport';
import errorHandling from './middleware/errorHandling';

const path = require('path');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');

const middleware = require('./middleware');
// const services = require('./services');
const appHooks = require('./app.hooks');

const authentication = require('./authentication');

const sequelize = require('./sequelize');
const solr = require('./solr');
const redis = require('./redis');
const celery = require('./celery');
const channels = require('./channels');
const multer = require('./multer');
const cache = require('./cache');
const cachedSolr = require('./cachedSolr');

const app = express(feathers());

// Load app configuration
app.configure(configuration());
// Enable Swagger if needed
app.configure(swagger);

// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(cookieParser());
// Host the public folder
app.use('/', express.static(path.join(__dirname, app.get('public'))));

// configure database adapters
app.configure(sequelize);
app.configure(solr);

// configure redis cahce if redis config is available
app.configure(redis);
// configure local multer service.
app.configure(multer);

app.set(
  'cacheManager',
  cache(app.get('redis'), app.get('cache').enabled, error => {
    console.error('Cache error. Restarting', error.stack);
    process.exit(1);
  })
);
app.set('cachedSolr', cachedSolr(app));

app.configure(transport);

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
app.configure(authentication);
// Set up our services (see `services/index.ts`)
app.configure(services);
// configure channels
app.configure(channels);
// configure celery client task manage if celery config is available
app.configure(celery);

app.configure(errorHandling);
app.configure(appHooks);

module.exports = app;
