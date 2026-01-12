import type { Sequelize } from 'sequelize'
import type { ImpressoApplication } from '@/types.js'
import type { Params as FeathersParams } from '@feathersjs/feathers'
import Debug from 'debug'
import { NotFound, BadRequest } from '@feathersjs/errors'
const debug = Debug('impresso:services/me')
import User, { Me } from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'
import { logger } from '@/logger.js'

interface Params extends FeathersParams {
  user: {
    id: string
    uid: string
  }
}

// firstname: 'Daniele Test',
// lastname: 'Guido',
// institutionalUrl: '',
// affiliation: 'affiliation',
// email: 'daniele.guido@uni.lu',
// password: '',
// repeatPassword: '',
// pattern: [ '#ccd6e6', '#d96459', '#f2ae72', '#ee6123', '#2e4051' ],
// displayName: 'Daniele Test Guido',
interface ServicePayload {
  firstname?: string
  lastname?: string
  institutionalUrl?: string
  affiliation?: string
  email?: string
  displayName?: string
  pattern?: string | string[]
}

export class Service {
  app: ImpressoApplication
  name: string
  sequelizeClient?: Sequelize

  constructor({ app, name }: { app: ImpressoApplication; name: string }) {
    this.app = app
    this.name = name
    this.sequelizeClient = app.get('sequelizeClient')
  }

  async find(params: Params): Promise<Me> {
    if (!this.sequelizeClient) {
      throw new Error(`[me] Sequelize client not available in ${this.name}`)
    }
    debug('[find] retrieve user from params query:', params.query)
    const userModel = User.sequelize(this.sequelizeClient)

    const user = await userModel.findByPk(params.user.id, {
      include: ['groups', 'profile', 'userBitmap'],
    })
    if (!user) {
      debug('[find] User not found with id:', params.user.id)
      throw new NotFound('User not found')
    }

    const response = User.getMe({
      user: {
        ...user.get(),
        bitmap: (user as any).userBitmap?.bitmap,
        groups: (user as any).groups?.map((d: Group) => d.toJSON()),
      },
      profile: (user as any).profile,
    })
    return response
  }

  async patch(_id: string | null, data: ServicePayload, params: Params): Promise<Me> {
    if (!this.sequelizeClient) {
      throw new Error(`Sequelize client not available in ${this.name}`)
    }
    debug(`[patch] (user:${params.user.uid}) - id:`, params.user.id, data)
    const userModel = User.sequelize(this.sequelizeClient)
    const profileModel = Profile.initModel(this.sequelizeClient)
    const transaction = await this.sequelizeClient.transaction()
    const { firstname, lastname, email } = data
    const { displayName, institutionalUrl, pattern, affiliation } = data

    try {
      await userModel.update(
        {
          firstname,
          lastname,
          email,
        },
        {
          where: {
            id: params.user.id,
          },
          transaction,
        }
      )
      if (displayName || institutionalUrl || affiliation || pattern) {
        debug(
          `[patch] (user:${params.user.uid}) updating profile with displayName: ${displayName}, institutionalUrl: ${institutionalUrl}, affiliation: ${affiliation}, pattern: ${pattern}`
        )
        await profileModel.update(
          {
            displayName,
            affiliation,
            institutionalUrl,
            pattern: Array.isArray(pattern) ? pattern.join(',') : pattern,
          },
          {
            where: {
              user_id: params.user.id,
            },
            transaction,
          }
        )
      }
      await transaction.commit()
    } catch (error) {
      debug(`[patch] (user:${params.user.uid}) error:`, error)
      logger.error(`[patch] (user:${params.user.uid}) error:`, error)
      await transaction.rollback()
      throw new BadRequest('Error updating user.')
    }

    const updatedUser = await userModel.findByPk(params.user.id, {
      include: ['groups', 'profile', 'userBitmap'],
    })
    if (!updatedUser) {
      debug('[patch] User not found with id:', params.user.id)
      throw new NotFound('User not found')
    }
    const response = User.getMe({
      user: {
        ...updatedUser.get(),
        bitmap: (updatedUser as any).userBitmap?.bitmap,
        groups: (updatedUser as any).groups?.map((d: Group) => d.toJSON()),
      },
      profile: (updatedUser as any).profile,
    })
    debug(`[patch] (user:${params.user.uid}) updated user:`, response)
    return response
  }
}
