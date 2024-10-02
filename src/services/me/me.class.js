/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:me')
const { BadRequest } = require('@feathersjs/errors')
const SequelizeService = require('../sequelize.service')
const User = require('../../models/users.model').default
const Profile = require('../../models/profiles.model')
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
    debug('[find] retrieve user from params:', params)
    const user = await measureTime(() => this.sequelizeService.get(params.user.id, {}), 'me.find.db.user')
    debug('[find] retrieve current user:', user.profile.uid)

    return User.getMe({
      user,
      profile: user.profile,
    })
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
