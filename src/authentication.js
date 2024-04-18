import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from './services/authentication/authentication.schema'

const debug = require('debug')('impresso/authentication')

const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication')
const { LocalStrategy } = require('@feathersjs/authentication-local')
const { NotAuthenticated } = require('@feathersjs/errors')
const User = require('./models/users.model')

class CustomisedAuthenticationService extends AuthenticationService {
  async getPayload(authResult, params) {
    const payload = await super.getPayload(authResult, params)
    const { user } = authResult
    if (user) {
      payload.userId = user.uid
      if (user.groups.length) {
        payload.userGroups = user.groups.map(d => d.name)
      }
    }
    return payload
  }
}

class HashedPasswordVerifier extends LocalStrategy {
  comparePassword(user, password) {
    return new Promise((resolve, reject) => {
      if (!(user instanceof User)) {
        debug('_comparePassword: user is not valid', user)
        return reject(new NotAuthenticated('Login incorrect'))
      }

      const isValid = User.comparePassword({
        encrypted: user.password,
        password,
      })

      if (!isValid) {
        return reject(new NotAuthenticated('Login incorrect'))
      }
      return resolve({
        ...user,
      })
    })
  }
}

module.exports = app => {
  const authentication = new CustomisedAuthenticationService(app)

  authentication.register('jwt', new JWTStrategy())
  authentication.register('local', new HashedPasswordVerifier())

  app.use('/authentication', authentication, {
    methods: ['create', 'remove'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })
}
