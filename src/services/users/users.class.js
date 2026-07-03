/* eslint-disable no-unused-vars */
import { nanoid } from 'nanoid'
import { getLogger } from '@/logger.js'
import User from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'
import { BadRequest, NotFound, MethodNotAllowed } from '@feathersjs/errors'
import { Op } from 'sequelize'
const logger = getLogger(['impresso', 'services', 'users'])
import { encrypt } from '@/crypto.js'
import sequelize from '@/sequelize.js'
import { sequelizeErrorHandler } from '@/services/sequelize.utils.js'

export class Service {
  constructor({ app }) {
    const client = app.get('sequelizeClient')
    if (!client) {
      throw new Error('Sequelize client not available in Users service')
    }
    this.sequelizeClient = client
    this.sequelizeKlass = User.sequelize(this.sequelizeClient)
    this.id = 'id'
    this.app = app
  }

  async get(id, params) {
    logger.debug(`[get] id: ${id} provider: ${params.provider} authenticated: ${params.authenticated}`)
    // if it is internal
    if (!params.authenticated && params.provider) {
      throw new MethodNotAllowed('Not allowed')
    }
    // if you're staff; otherwise get your own.
    const userModel = await this.sequelizeKlass
      .scope('isActive')
      // findOne doesn't support '$profile.uid$' in where clause
      .findAll({
        where: {
          [Op.or]: [
            { id: parseInt(id, 10) },
            { username: String(id) },
            {
              // https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/#complex-where-clauses-at-the-top-level
              '$profile.uid$': String(id),
            },
          ],
        },
        include: ['groups', 'profile', 'userBitmap'],
      })
      .then(res => res[0])

    if (!userModel) {
      logger.debug(`[get] uid not found <uid>: ${id}`)
      throw new NotFound()
    }
    // const groups = await user.getGroups().then(res => res.map(d => d.toJSON()))
    const groups = userModel.groups?.map(d => d.toJSON())
    logger.debug(`[get] user <uid>: ${userModel.profile.uid} <groups>: ${groups} <bitmap>: ${userModel.userBitmap?.bitmap}`)
    return userModel.toJSON({ groups, userBitmap: userModel.userBitmap })
  }

  async create(data, params = {}) {
    const uid = `local-${nanoid(8)}` //= > "7hy8hvrX"
    // prepare user.
    const user = new User({
      uid,
      firstname: data.sanitized.firstname,
      lastname: data.sanitized.lastname,
      username: data.sanitized.username,
      email: data.sanitized.email,
      password: User.buildPassword({
        password: data.sanitized.password,
      }),
      isActive: false,
    })
    // check if user already exists
    const existingUser = await this.sequelizeKlass.findOne({
      where: {
        [Op.or]: [{ email: user.email }, { username: user.username }],
      },
    })

    if (existingUser) {
      logger.debug(`[create] user already exists: ${existingUser.id}`)
      throw new BadRequest('User with this email address or username already exists')
    } else {
      logger.debug(`[create] new user: ${user.username} ${data.sanitized}`)
    }
    // create user
    const createdUser = await this.sequelizeKlass.create(user).catch(sequelizeErrorHandler)
    logger.debug(`[create] user created! ${createdUser.id}`)
    // create profile
    const userProfile = await Profile.create({
      uid,
      user_id: createdUser.id,
      displayName: data.sanitized.displayName,
      provider: 'local',
      affiliation: data.sanitized.affiliation,
      institutionalUrl: data.sanitized.institutionalUrl,
      pattern: data.sanitized.pattern,
    }).catch(sequelizeErrorHandler)
    logger.debug(`[create] profile created! ${userProfile.toJSON()}`)
    // add user to desired groups (they are still not active)
    const [group, created] = await Group.findOrCreate({
      where: { name: data.sanitized.plan },
    })
    logger.debug(`[create] group ${group.name} created: ${created}`)
    createdUser.addGroup(group)

    logger.debug(`[create] user with profile: ${user.uid} success`)
    logger.debug(`[create] user ${user.username} created! ${createdUser.toJSON()}`)

    const client = this.app.get('celeryClient')
    if (client) {
      logger.debug(`[create] inform impresso admin to activate this user: ${user.uid}`)
      await client
        .run({
          task: 'impresso.tasks.after_user_registered',
          args: [createdUser.id],
        })
        .catch(err => {
          logger.debug(`Error ${err}`)
        })
    }

    // send email to user
    return {
      ...createdUser.toJSON(),
      profile: userProfile.toJSON(),
      groups: [group.toJSON()],
    }
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    // e.g we can change here the picture or the password
    if (data.sanitized.password && params.user.is_staff) {
      // change password directly.
      logger.debug(`change password requested for user:${id}`)
      return this._run(this.queries.patch, {
        uid: id,
        ...encrypt(data.sanitized.password),
      }).then(res => this._finalize(res))
    }
    return {
      id,
    }
  }

  async remove(id, params) {
    if (!params.user.is_staff) {
      return { id }
    }

    // get user to be removed
    const user = await this.sequelizeKlass.scope('get').findOne({
      where: {
        [Op.or]: [{ username: id }, { '$profile.uid$': id }],
      },
    })
    if (!user) {
      return {
        id,
      }
    }
    logger.debug(`remove: profile for ${user.username}`)
    if (user.profile) {
      await user.profile.destroy()
    }

    // no way, should be a cascade...
    logger.debug(`remove: user ${user.username}`)
    const results = await Promise.all([
      // remove from mysql
      user.destroy().catch(sequelizeErrorHandler),
      // remove from neo4j
      // this._run(this.queries.remove, {
      //   uid: id,
      // }),
    ])
    logger.debug(`remove: ${user.username} success! User id ${results[0].id}`)

    // logger.debug(`remove: ${user.username} success,
    //   sequelize: ${results[0]},
    //   neo4j: ${results[1].summary.counters._stats.nodesDeleted}`);
    // return {
    //   ...this._finalizeRemove(results[1]),
    //   removed: results[0],
    //   id,
    // };
    return {
      removed: results[0],
      id,
    }
  }

  async find(params) {
    logger.debug(`[find] query: ${params.query} provider: ${params.provider}`)
    let uid
    // if it is internal
    if (params.provider) {
      throw new MethodNotAllowed('Not allowed')
    }
    if (params.sanitized.githubId) {
      uid = `github-${params.sanitized.githubId}`
    } else if (params.sanitized.email) {
      uid = params.sanitized.email
    } else if (params.sanitized.uid) {
      uid = params.sanitized.uid
    }

    let sequelizeParams = {}

    // e.g. during authentication process
    if (uid) {
      sequelizeParams = {
        where: {
          [Op.or]: [{ email: uid }, { username: uid }, { '$profile.uid$': uid }],
        },
      }
    }

    return this.sequelizeKlass
      .scope('isActive', 'find')
      .findAll(sequelizeParams)
      .then(res => res.map(d => new User(d.toJSON())))
  }
}

export default function (options) {
  return new Service(options)
}
