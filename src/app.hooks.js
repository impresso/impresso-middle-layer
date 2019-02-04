// Application hooks that run for every service
const logger = require('./hooks/logger');
const { validateRouteId } = require('./hooks/params');
const { authenticate } = require('@feathersjs/authentication').hooks;

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
  console.log('hook:requireAuthentication', context.path, !allowUnauthenticated);
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
    all: [logger()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [logger()],
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

  // based on config
  if (config.alwaysRequired) {
    hooks.before.all.push(requireAuthentication());
  }
  // set hooks
  app.hooks(hooks);
};
