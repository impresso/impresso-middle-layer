// Application hooks that run for every service
const debug = require('debug')('impresso/app.hooks');
const { authenticate } = require('@feathersjs/authentication').hooks;
const { validateRouteId } = require('./hooks/params');

const basicParams = () => (context) => {
  if (!context.params) {
    context.params = {};
  }
  if (!context.params.query) {
    context.params.query = {};
  }
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
    all: [
      // logger()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
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
