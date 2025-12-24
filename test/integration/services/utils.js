import debugModule from 'debug'
const debug = debugModule('impresso/test:utils')
import app from '@/app'
import sequelize from '@/sequelize'

import Collection from '@/models/user-collection'
import User from '@/models/users.model'

const removeGeneratedUser = async user => {
  const client = sequelize.client(app.get('sequelize'))
  debug(`removeGeneratedUser: '${user.username}'`)

  const userInDb = await User.sequelize(client).findOne({
    where: {
      username: user.username,
    },
  })

  if (userInDb) {
    debug(`removeGeneratedUser: user exists '${user.username}', id:${userInDb.id}`)

    // await CollectableItem.sequelize(client).destroy({
    //   include: {
    //     model: Collection.sequelize(client),
    //     as: 'collection',
    //   },
    //   where: {
    //     '$collection.creator_id$': userInDb.id,
    //   },
    // });
    await Collection.sequelize(client).destroy({
      where: {
        creator_id: userInDb.id,
      },
    })
  }

  // remove all
  await app.service('users').remove(user.username, {
    user: {
      is_staff: true,
    },
  })
}

const generateUser = async user => {
  // ensure we always have the minimum
  const userToGenerate = {
    username: 'local-user-test-only',
    password: 'Impresso2018!',
    email: 'local-user-test-only@impresso-project.ch',
    ...user,
  }

  await removeGeneratedUser(userToGenerate)
  debug('generateUser username=', userToGenerate.username)
  const result = await app.service('users').create({
    ...userToGenerate,
  })
  debug('generateUser: ok', result.username)
  return result
}

export default {
  generateUser,
  removeGeneratedUser,
}
