import assert from 'assert'
import debug from 'debug'

import { client as getSequelizeClient } from '../../src/sequelize'
import configuration, { SequelizeConfiguration } from '../../src/configuration'

import User, { UserAttributes } from '../../src/models/users.model'
import UserBitmap from '../../src/models/user-bitmap.model'
import Group from '../../src/models/groups.model'

const logger = debug('impresso/test:models:users.model.test')
const userId = process.env.USER_ID
const config: SequelizeConfiguration = configuration()().get('sequelize')

logger(`Test started using env variable USER_ID: ${userId} and NODE_ENV=${process.env.NODE_ENV}`)
logger(`Sequelize configuration: ${config.host}:${config.port} db:${config.database}`)

const sequelizeClient = getSequelizeClient(config)

const establishConnection = async () => {
  try {
    await sequelizeClient.authenticate()
    logger('Connection has been established successfully.')
  } catch (error) {
    logger('Unable to connect to the database:', error)
  }
}

const closeConnection = async () => {
  await sequelizeClient.close()
}

describe('Test the connection with the DB', async () => {
  before(establishConnection)
  after(closeConnection)
  if (!userId) {
    console.log(
      'No user id provided in ENV variable, skipping this test. Please make sure you provide the identifier with USER_ID:'
    )
    return
  }
  it('should return the id if provided', () => {
    const userModel = User.sequelize(sequelizeClient)

    userModel
      .findByPk(userId)
      .then(user => {
        const usera: any = user
        assert.notEqual(user, null, 'The user is null')
        if (!user) {
          logger(`User not found with id: ${userId}`)
          return
        }
        logger(`User found: ${usera?.username} with id: ${usera.id}`)
        logger(`User bitmap: ${usera?.userBitmap?.bitmap}`)
      })
      .catch(err => {
        logger(`Error: ${err}`)
      })
  })

  it('should return the groups if provided', () => {
    const userModel = User.sequelize(sequelizeClient)
    logger('should return the groups', userId)
    userModel
      .findOne({
        where: { id: userId },
        include: ['groups'],
        logging: console.log,
      })
      .then(user => {
        const usera: UserAttributes = user as any as UserAttributes
        logger(`User groups:\n - ${usera.groups.map((group: Group) => group.name).join('\n - ')}`)
      })
      .catch(err => {
        assert.fail(`Error: ${err}`)
      })
  })

  it('should check its bitmap', async () => {
    const userModel = User.sequelize(sequelizeClient)
    // const userModelBitmap = userModel.associations.userBitmap

    const binaryString = await userModel
      .findByPk(userId)
      .then(user => {
        const usera: any = user
        if (!user) {
          logger(`User not found with id: ${userId}`)
          return '0'
        }
        // const buffer = usera?.userBitmap.bitmap as Buffer
        // // console.log(usera?.userBitmap.bitmap.toString('binary'))
        // // Convert the buffer to a binary string
        // const binaryString = Array.from(buffer)
        //   .map(byte => byte.toString(2).padStart(8, '0'))
        //   .join('')
        //   .replace(/^0+/, '')

        // console.log(binaryString)
        return usera?.userBitmap.bitmap
      })
      .catch(err => {
        logger(`Error: ${err}`)
        assert.fail(`Error: ${err}`)
      })
    console.log('binary string,', binaryString)
    // test that binarysgtring contains only 0 an 1
    const expected = /^[01]+$/
    assert.ok(expected.test(binaryString), 'The binary string contains invalid characters')
  })

  it('should get user subscription through its bitmap', async () => {
    const userBitmapModel = UserBitmap.sequelize(sequelizeClient)

    userBitmapModel.findOne({ where: { user_id: userId } }).then(userBitmap => {
      console.log('User sbscriptions', userBitmap?.toJSON())
      const userBitmapa = userBitmap as any as UserBitmap
      userBitmapa.subscriptionDatasets?.map(dataset => {
        console.log('Datasets:', dataset.name)
      })
    })
  })
})
