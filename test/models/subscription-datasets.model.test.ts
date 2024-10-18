import assert from 'assert'
import debug from 'debug'

import { client as getSequelizeClient } from '../../src/sequelize'
import configuration, { SequelizeConfiguration } from '../../src/configuration'

import SubscriptionDataset, { SubscriptionDatasetAttributes } from '../../src/models/subscription-datasets.model'

const logger = debug('impresso/test:models:subscription-datasets.model.test')
const userId = process.env.USER_ID
const config: SequelizeConfiguration = configuration()().get('sequelize')

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
/**
 *
 * ```bash
 * NODE_ENV=test DEBUG=impresso* npm run test-models
 * ```
 */
describe('Available Datasets for Subscription along with their bitmap positions', async () => {
  before(establishConnection)
  after(closeConnection)

  it('should return the list of available datasets', async () => {
    const subscriptionDatasetModel = SubscriptionDataset.sequelize(sequelizeClient)

    await subscriptionDatasetModel
      .findAll()
      .then(data => {
        logger(`Datasets found: ${data.length}`)
        for (const dataset of data) {
          const dataseta = dataset as any as SubscriptionDatasetAttributes
          console.log(`  - Dataset: [id:${dataseta.id}] ${dataseta.name} - ${dataseta.bitmapPosition}`)
        }
        // not empty
        assert.notEqual(data.length, 0, 'The datasets are empty')
      })
      .catch(err => {
        assert.fail(`Error: ${err}`)
      })
  })
})
