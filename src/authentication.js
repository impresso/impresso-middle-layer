const authentication = require('@feathersjs/authentication');
const jwt = require('@feathersjs/authentication-jwt');
const local = require('@feathersjs/authentication-local');
const oauth2 = require('@feathersjs/authentication-oauth2');
const GithubStrategy = require('passport-github').Strategy;
const { Verifier } = require('@feathersjs/authentication-local');
const { comparePassword } = require('./crypto');

/**
 * Custom verifier to compare SALT in db
 *
 * @returns
 */
class HashedPasswordVerifier extends Verifier {
  _comparePassword(entity, password) {
    // select entity password field - take entityPasswordField over passwordField
    const passwordField = this.options.entityPasswordField || this.options.passwordField;
    const saltField = this.options.entitySaltField || this.options.saltField || 'salt';

    if (!entity || !entity[passwordField] || !entity[saltField]) {
      return Promise.reject(new Error(`'${this.options.entity}' record in the database is missing a '${passwordField}' or a '${saltField}'`));
    }

    const encrypted = entity[passwordField];
    const salt = entity[saltField];

    // debug('Verifying password');
    return new Promise((resolve, reject) => {
      const isValid = comparePassword(password, encrypted, salt, '');
      if (!isValid) {
        // debug('Login incorrect');
        return reject(new Error('Login incorrect'));// false);
      }
      // debug('Password correct');
      return resolve(entity);
    });
  }

  verify(req, username, password, done) {
    super.verify(req, username, password, done);
  }
}

module.exports = function () {
  const app = this;
  const config = app.get('authentication');
  console.log('creating authentication sercice');
  // Set up authentication with the secret
  app.configure(authentication(config));
  app.configure(jwt());
  app.configure(local({
    Verifier: HashedPasswordVerifier,
  }));
  app.configure(oauth2({
    name: 'github',
    Strategy: GithubStrategy,
  }));
  // The `authentication` service is used to create a JWT.
  // The before `create` hook registers strategies that can be used
  // to create a new valid JWT (e.g. local or oauth2)
  app.service('authentication').hooks({
    before: {
      create: [
        authentication.hooks.authenticate(config.strategies),
      ],
      remove: [
        authentication.hooks.authenticate('jwt'),
      ],
    },
  });
};
