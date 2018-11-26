const debug = require('debug')('impresso/authentication');
const authentication = require('@feathersjs/authentication');
const jwt = require('@feathersjs/authentication-jwt');
const local = require('@feathersjs/authentication-local');
const oauth2 = require('@feathersjs/authentication-oauth2');
const GithubStrategy = require('passport-github').Strategy;
const { Verifier } = require('@feathersjs/authentication-local');
const User = require('./models/users.model');
const { BadRequest } = require('@feathersjs/errors');
/**
 * Custom verifier to compare SALT in db
 *
 * @returns
 */
class HashedPasswordVerifier extends Verifier {
  _comparePassword(user, password) {
    return new Promise((resolve, reject) => {
      if (!(user instanceof User)) {
        debug('_comparePassword: user is not valid', user);
        return reject(new BadRequest('Login incorrect'));
      }

      const isValid = User.comparePassword({
        encrypted: user.password,
        password,
      });

      if (!isValid) {
        return reject(new BadRequest('Login incorrect'));
      }
      return resolve({
        ...user,
      });
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

        // modify payload params
        (context) => {
          // enrich payload with staff and groups
          context.params.payload = {
            ...context.params.payload,
            userId: context.params.user.uid,
            isStaff: context.params.user.isStaff,
            g: ['nda'],
          };
        },
      ],
      remove: [
        authentication.hooks.authenticate('jwt'),
      ],
    },
  });
};
