import assert from 'assert'
import { feathers } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'

import registerSpecialMembershipAccessService from '@/services/special-membership-access/special-membership-access.service.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from '../../helpers/database.js'

describe('special-membership-access service integration', () => {
  let db: TestDatabase
  let app: any

  before(async () => {
    db = setupTestDatabase()
    app = feathers()
    app.set('sequelizeClient', db.sequelize)
    await registerSpecialMembershipAccessService(app)
    await db.sequelize.sync({ force: true })
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  it('rejects patch payload with unsupported metadata modality', async () => {
    const model = SpecialMembershipAccess.initialize(db.sequelize)
    const record = await model.create({
      title: 'Integration Access',
      bitmapPosition: 123,
      reviewerId: 1,
      metadata: { modality: 'notify_reviewer' },
    })

    const service = app.service('special-membership-access')

    await assert.rejects(
      () =>
        service.patch(
          record.id,
          {
            metadata: {
              modality: 'invalid_modality',
            },
          },
          {
            user: {
              id: 1,
            },
          }
        ),
      (error: any) => {
        assert.ok(error instanceof BadRequest)
        assert.match(error.message, /JSON validation errors/i)
        return true
      }
    )
  })
})
