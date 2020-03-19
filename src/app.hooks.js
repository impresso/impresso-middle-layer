// Application hooks that run for every service
const debug = require('debug')('impresso/app.hooks');
const { GeneralError, BadGateway } = require('@feathersjs/errors');
const { authenticate } = require('@feathersjs/authentication').hooks;
const { validateRouteId } = require('./hooks/params');

const basicParams = () => (context) => {
  if (!context.params) {
    context.params = {};
  }
  if (!context.params.query) {
    context.params.query = {};
  }
  ['limit', 'page', 'offset'].forEach((param) => {
    if (context.params.query[param]) {
      context.params.query[param] = parseInt(context.params.query[param], 10);
    }
  });
};


/**
 * Ensure JWT has been sent, except for the authentication andpoint.
 * @return {[type]} [description]
 */
const requireAuthentication = ({
  excludePaths = ['authentication', 'users', 'newspapers'],
} = {}) => (context) => {
  const allowUnauthenticated = excludePaths.indexOf(context.path) !== -1;
  debug('hook:requireAuthentication', context.path, !allowUnauthenticated);
  if (!allowUnauthenticated) {
    return authenticate('jwt')(context);
  }
  return context;
};

const LoggingExcludedStatusCodes = [
  401, 403, 404,
];

const errorHandler = (ctx) => {
  if (ctx.error) {
    const error = ctx.error;
    if (!LoggingExcludedStatusCodes.includes(error.code)) {
      console.error(
        `ERROR ${error.code || error.type || 'N/A'} ${error.name} at ${ctx.path}:${ctx.method}: `,
        error.stack,
      );
    }

    if (error.name === 'SequelizeConnectionRefusedError') {
      ctx.error = new BadGateway('SequelizeConnectionRefusedError');
    } else if (error.name === 'SequelizeConnectionError') {
      ctx.error = new BadGateway('SequelizeConnectionError');
    } else if (!error.code) {
      ctx.error = new GeneralError('server error');
    }
    if (error.code === 404 || process.env.NODE_ENV === 'production') {
      error.stack = null;
    }
    return ctx;
  }
  return null;
};


const hooks = {
  before: {
    all: [
      validateRouteId(),
    ],
    find: [
      basicParams(),
    ],
    get: [
      basicParams(),
    ],
    create: [
      basicParams(),
    ],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [
      errorHandler,
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};

module.exports = function (app) {
  const config = app.get('appHooks');
  debug('global hooks configuration', config);
  // based on config
  if (config.alwaysRequired) {
    hooks.before.all.push(requireAuthentication({
      excludePaths: ['authentication', 'users'].concat(config.excludePaths),
    }));
  }
  // set hooks
  app.hooks(hooks);
};
