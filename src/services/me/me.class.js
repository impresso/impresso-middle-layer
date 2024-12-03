/* eslint-disable no-unused-vars */
import User from '../../models/users.model'
import Profile from '../../models/profiles.model'

const debug = require('debug')('impresso/services:me')
const { BadRequest } = require('@feathersjs/errors')
const SequelizeService = require('../sequelize.service')
const { measureTime } = require('../../util/instruments')

class Service {
  constructor(options) {
    this.options = options || {}
  }

  setup(app) {
    this.app = app
    this.sequelizeService = new SequelizeService({
      app,
      name: 'me',
      modelName: 'users',
    })
  }

  async find(params) {
    debug('[find] retrieve user from params query:', params.query)
    const client = this.app.get('sequelizeClient')
    const user = await User.sequelize(client).findByPk(params.user.id, {
      include: ['groups', 'profile', 'userBitmap'],
    })
    debug('[find] retrieve current user:', user.profile.uid, user.userBitmap?.bitmap, user.toJSON())

    const response = User.getMe({
      user: {
        ...user.get(),
        bitmap: user.userBitmap?.bitmap,
        groups: user.groups?.map(d => d.toJSON()),
      },
      profile: user.profile,
    })
    debug('[find] response:', response)
    return response
  }

  async update(id, data, params) {
    debug(`[update] (user:${params.user.uid}) - id:`, params.user.id, data)
    const client = this.app.get('sequelizeClient')
    const { firstname, lastname, email, displayName, pattern } = data.sanitized
    // update user ADN its profile:
    const result = await Promise.all([
      User.sequelize(client).update(
        {
          firstname,
          lastname,
          email,
        },
        {
          where: {
            id: params.user.id,
          },
        }
      ),
      Profile.sequelize(client).update(
        {
          displayName,
          pattern,
        },
        {
          where: {
            user_id: params.user.id,
          },
        }
      ),
    ])
    debug(`[update] (user:${params.user.uid}) success! Result:`, result, params.user)
    return User.getMe({
      user: {
        ...params.user,
        firstname,
        lastname,
        email,
      },
      profile: {
        ...params.user.profile,
        displayName,
        pattern: pattern.split(','),
      },
    })
  }

  async patch(id, data, params) {
    debug(`[patch] (user:${params.user.uid}) - id:`, params.user.id)
    const user = await this.sequelizeService.get(params.user.id, {})
    const patches = {}

    if (data.sanitized.previousPassword && data.sanitized.newPassword) {
      const isValid = User.comparePassword({
        encrypted: user.password,
        password: data.sanitized.previousPassword,
      })

      if (!isValid) {
        debug('[patch] previous password is wrong')
        throw new BadRequest('Wrong credentials')
      }
      // new password
      patches.password = User.buildPassword({ password: data.sanitized.newPassword })
      debug(`[patch] (user:${params.user.uid}) set password...`)
    }
    // apply patches
    const patchesApplied = Object.keys(patches)
    if (!patchesApplied.length) {
      throw new BadRequest('Nothing to patch')
    }
    const result = await this.sequelizeService.patch(
      params.user.id,
      {
        ...patches,
      },
      {}
    )
    debug(`[patch] (user:${params.user.uid}) patches applied!`)
    return {
      uid: user.uid,
      patchesApplied,
    }
  }

  async remove(id, params) {
    // ask for user removal !
    return { id }
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
