import {
  AuthenticationParams,
  AuthenticationRequest,
  AuthenticationResult,
  AuthenticationService,
  JWTStrategy,
  JwtVerifyOptions,
} from '@feathersjs/authentication'
import { logger } from '@/logger.js'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { NotAuthenticated } from '@feathersjs/errors'
import { ServiceOptions } from '@feathersjs/feathers'
import initDebug from 'debug'
import swagger from 'feathers-swagger'
import User from '@/models/users.model.js'
import { docs } from '@/services/authentication/authentication.schema.js'
import { ImpressoApplication } from '@/types.js'
import { BufferUserPlanGuest } from '@/models/user-bitmap.model.js'
import { bigIntToBuffer, bufferToBigInt } from '@/util/bigint.js'
import type { Sequelize } from 'sequelize'

const { createSwaggerServiceOptions } = swagger

const debug = initDebug('impresso/authentication')
debug('initialising authentication')
/**
 * Using base64 for the bitmap to keep the size
 * of the JWT token as small as possible.
 */
type AuthPayload = Omit<SlimUser, 'uid' | 'id' | 'bitmap'> & {
  userId: string
  bitmap: string // bigint as a base64 string
}

class CustomisedAuthenticationService extends AuthenticationService {
  async getPayload(authResult: AuthenticationResult, params: AuthenticationParams) {
    const payload = (await super.getPayload(authResult, params)) as AuthPayload
    const { user } = authResult as { user: User }

    if (user) {
      payload.userId = user.uid
      if (user.groups.length) {
        payload.groups = user.groups.map(d => d.name)
      }
      payload.isStaff = user.isStaff
      payload.bitmap = bigIntToBuffer(user.bitmap != null ? BigInt(user.bitmap) : BufferUserPlanGuest).toString(
        'base64'
      )
    }
    return payload
  }
}

class HashedPasswordVerifier extends LocalStrategy {
  app: ImpressoApplication
  constructor(app: ImpressoApplication) {
    super()
    this.app = app
  }
  async comparePassword(user: User, password: string) {
    if (!(user instanceof User)) {
      debug('_comparePassword: user is not valid', user)
      throw new NotAuthenticated('Login incorrect')
    }
    const isValid = User.comparePassword({
      encrypted: user.password,
      password,
    })
    if (!isValid) {
      throw new NotAuthenticated('Login incorrect')
    }
    debug('_comparePassword: password is valid. user: ', user.id)
    // update user lastLogin
    // get current app sequelize
    const sequelizeClient = this.app.get('sequelizeClient') as Sequelize

    try {
      const affectedCount = await User.sequelize(sequelizeClient).update(
        {
          lastLogin: new Date(),
        },
        {
          where: {
            id: user.id,
          },
        }
      )
      debug('_comparePassword: updated login for user, count updated:', affectedCount)
    } catch (err) {
      logger.error(`Error updating login for user ${user.id}`, err)
      debug('_comparePassword: error updating login for user', err)
    }
    return {
      ...user,
    }
  }
}

export interface SlimUser {
  uid: string
  id: number
  isStaff: boolean
  bitmap: bigint
  groups: string[]
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
      bitmap: payload.bitmap != null ? bufferToBigInt(Buffer.from(payload.bitmap, 'base64')) : BufferUserPlanGuest,
      isStaff: payload.isStaff ?? false,
      groups: payload.groups ?? [],
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
    if (authConfig?.jwtOptions?.audience != null) {
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
  const useDbUserInRequestContext = app.get('authentication')?.useDbUserInRequestContext
  const authentication = new CustomisedAuthenticationService(app)

  const jwtStrategy = useDbUserInRequestContext ? new JWTStrategy() : new NoDBJWTStrategy()

  authentication.register('jwt', jwtStrategy)
  authentication.register('local', new HashedPasswordVerifier(app))

  if (isPublicApi) {
    authentication.register('jwt-app', new ImlAppJWTStrategy())
  }

  app.use('/authentication', authentication, {
    methods: isPublicApi ? ['create'] : undefined,
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)
}
