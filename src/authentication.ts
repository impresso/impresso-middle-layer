import {
  AuthenticationParams,
  AuthenticationRequest,
  AuthenticationResult,
  AuthenticationService,
  JWTStrategy,
  JwtVerifyOptions,
} from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { NotAuthenticated } from '@feathersjs/errors'
import { ServiceOptions } from '@feathersjs/feathers'
import initDebug from 'debug'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import User from './models/users.model'
import { docs } from './services/authentication/authentication.schema'
import { ImpressoApplication } from './types'

const debug = initDebug('impresso/authentication')

class CustomisedAuthenticationService extends AuthenticationService {
  async getPayload(authResult: AuthenticationResult, params: AuthenticationParams) {
    const payload = await super.getPayload(authResult, params)
    const { user } = authResult as { user: User }
    if (user) {
      payload.userId = user.uid
      if (user.groups.length) {
        payload.userGroups = user.groups.map(d => d.name)
      }
      payload.isStaff = user.isStaff
    }
    return payload
  }
}

class HashedPasswordVerifier extends LocalStrategy {
  comparePassword(user: User, password: string) {
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

export interface SlimUser {
  uid: string
  id: number
  isStaff: boolean
}

/**
 * A custom JWT strategy that does not load the user from the database.
 * Instead, it uses the payload from the JWT token to create a slim user object
 * which is enough for most of the use cases across the codebase.
 * Where a full user object is required, it is requested explicitly.
 */
class NoDBJWTStrategy extends JWTStrategy {
  async authenticate(authentication: AuthenticationRequest, params: AuthenticationParams) {
    const { accessToken } = authentication
    const { entity } = this.configuration
    if (!accessToken) {
      throw new NotAuthenticated('No access token')
    }
    const payload = await this.authentication?.verifyAccessToken(accessToken, params.jwt)
    const result = {
      accessToken,
      authentication: {
        strategy: 'jwt',
        accessToken,
        payload,
      },
    }
    if (entity === null) {
      return result
    }

    const slimUser: SlimUser = {
      uid: payload.userId,
      id: parseInt(payload.sub),
      isStaff: payload.isStaff ?? false,
    }
    return {
      ...result,
      [entity]: slimUser,
    }
  }
}

/**
 * A custom JWT strategy that verifies the IML (web app) JWT
 * token and issues a public API short-lived token.
 */
class ImlAppJWTStrategy extends JWTStrategy {
  async authenticate(authentication: AuthenticationRequest, params: AuthenticationParams) {
    const { accessToken } = authentication
    if (!accessToken) {
      throw new NotAuthenticated('No access token')
    }

    const authConfig = (this.app as ImpressoApplication)?.get('imlAuthConfiguration')

    const imlOps: JwtVerifyOptions = { ...params.jwt }
    if (authConfig != null) {
      imlOps.audience = authConfig.jwtOptions.audience
    }

    const payload = await this.authentication?.verifyAccessToken(accessToken, imlOps, authConfig?.secret)

    const { entity } = this.configuration

    return {
      authentication: { strategy: this.name },
      [entity]: await this.getEntity(payload.sub, params),
    } as any
  }

  get configuration() {
    const authConfig = this.authentication?.configuration
    const config = super.configuration
    return {
      ...config,
      service: authConfig?.service,
      entity: authConfig?.entity,
      entityId: authConfig?.entityId,
      header: '',
      schemes: ['JWT-APP'],
    }
  }
}

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi')
  const useDbUserInRequestContext = app.get('useDbUserInRequestContext')
  const authentication = new CustomisedAuthenticationService(app)

  const jwtStrategy = useDbUserInRequestContext ? new JWTStrategy() : new NoDBJWTStrategy()

  authentication.register('jwt', jwtStrategy)
  authentication.register('local', new HashedPasswordVerifier())
  authentication.register('jwt-app', new ImlAppJWTStrategy())

  app.use('/authentication', authentication, {
    methods: isPublicApi ? ['create'] : undefined,
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)
}
