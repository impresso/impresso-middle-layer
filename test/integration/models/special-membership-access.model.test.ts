import assert from 'assert'
import app from '@/app.js'
import { SequelizeConfig } from '@/models/generated/common.js'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '@/models/special-membership-access.model.js'

const config: SequelizeConfig = app.get('sequelize')

console.log(`Sequelize configuration: ${config.host}:${config.port} db:${config.database}`)

const sequelizeClient = app.get('sequelizeClient')

const establishConnection = async () => {
  try {
    await sequelizeClient?.authenticate()
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.log('Unable to connect to the database:', error)
  }
}

const closeConnection = async () => {
  await sequelizeClient?.close()
}
/**
 *
 * ```bash
 * NODE_ENV=test DEBUG=impresso* npm run test-models
 * ```
 */
describe('Available Datasets for Subscription along with their bitmap positions', () => {
  before(establishConnection)
  after(closeConnection)

  it('should return the list of available datasets', async () => {
    const subscriptionDatasetModel = SpecialMembershipAccess.initialize(sequelizeClient!)

    await subscriptionDatasetModel
      .findAll()
      .then(data => {
        console.log(`Datasets found: ${data.length}`)
        for (const dataset of data) {
          const dataseta = dataset as any as ISpecialMembershipAccessAttributes

          console.log(`  - Dataset: [id:${dataseta.id}] ${dataseta.title} - ${dataseta.bitmapPosition}`)
        }
        // not empty
        assert.notEqual(data.length, 0, 'The datasets are empty')
      })
      .catch(err => {
        assert.fail(`Error: ${err}`)
      })
  })
})
