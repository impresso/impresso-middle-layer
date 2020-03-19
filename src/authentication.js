const debug = require('debug')('impresso/authentication');
const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');
const { expressOauth } = require('@feathersjs/authentication-oauth');
const { Unauthorized } = require('@feathersjs/errors');
const User = require('./models/users.model');

class HashedPasswordVerifier extends LocalStrategy {
  comparePassword(user, password) {
    return new Promise((resolve, reject) => {
      if (!(user instanceof User)) {
        debug('_comparePassword: user is not valid', user);
        return reject(new Unauthorized('Login incorrect'));
      }

      const isValid = User.comparePassword({
        encrypted: user.password,
        password,
      });

      if (!isValid) {
        return reject(new Unauthorized('Login incorrect'));
      }
      return resolve({
        ...user,
      });
    });
  }
}

module.exports = (app) => {
  const authentication = new AuthenticationService(app);

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new HashedPasswordVerifier());

  app.use('/authentication', authentication);
  app.configure(expressOauth());
};
