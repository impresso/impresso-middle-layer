/**
 * A wrapper around authenticate hook from featherjs
 * to enabe allowUnauthenticate again ...
 */
const { authenticate } = require('@feathersjs/authentication').hooks;

const authenticateWrapper = (strategy = 'jwt', { allowUnauthenticated = false } = {}) => context => authenticate(strategy)(context).catch((err) => {
  if (!allowUnauthenticated) {
    throw err;
  }
});


module.exports = {
  authenticate: authenticateWrapper,
};
