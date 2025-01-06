import assert from 'assert'
import debug from 'debug'
import configuration from '../../../src/configuration'

import { client as getSequelizeClient } from '../../../src/sequelize'
import UserChangePlanRequest from '../../../src/models/user-change-plan-request'
const logger = debug('impresso/test:models:users.model.test')
const userId = process.env.USER_ID
const config = configuration()().get('sequelize')

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

describe('UserChangeRequest Model', async () => {
  before(establishConnection)
  after(closeConnection)
  if (!userId) {
    console.log(
      'No user id provided in ENV variable, skipping this test. Please make sure you provide the identifier with USER_ID:'
    )
    return
  }

  it('should find a user change request by identifier from ENV', async () => {
    const userChangePlanRequestModel = UserChangePlanRequest.initModel(sequelizeClient)
    const userChangePlanRequest = await userChangePlanRequestModel.findOne({
      where: {
        userId,
      },
    })
    console.log(userChangePlanRequest)
  })
})
