import { strict as assert } from 'assert'
import { loadExportingUser } from '@/jobs/searchResults/exportSearchResults.js'
import User from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import { BufferUserPlanGuest, BufferUserPlanResearcher } from '@/models/user-bitmap.model.js'
import { bigIntToBuffer } from '@/util/bigint.js'
import { setupTestDatabase, teardownTestDatabase, type TestDatabase } from '../../helpers/database.js'

describe('loadExportingUser', () => {
  let db: TestDatabase

  const getModel = (name: string) => {
    const model = db.sequelize.models[name]
    if (model == null) throw new Error(`Model ${name} is not defined`)
    return model
  }

  const createUser = async (id: number, { isActive = true }: { isActive?: boolean } = {}) => {
    await getModel('user').create({
      id,
      email: `user${id}@example.com`,
      uid: '',
      username: `user${id}`,
      firstname: 'Jane',
      lastname: 'Doe',
      password: 'x',
      isActive,
      isStaff: false,
      isSuperuser: false,
    })
    await getModel('Profile').create({ uid: `local-user${id}`, user_id: id, provider: 'local' })
  }

  before(async () => {
    db = setupTestDatabase()
    User.sequelize(db.sequelize)
    await db.sequelize.sync({ force: true })
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  beforeEach(async () => {
    await db.sequelize.truncate({ cascade: true })
  })

  it('returns the user with their permissions bitmap and groups', async () => {
    await createUser(1)
    await getModel('userBitmap').create({ user_id: 1, bitmap: BufferUserPlanResearcher })
    const group = await Group.create({ name: 'plan-researcher' })
    await getModel('auth_user_groups').create({ user_id: 1, group_id: group.id })

    const user = await loadExportingUser(db.sequelize, '1')

    assert.deepEqual(user, {
      id: 1,
      uid: 'local-user1',
      isStaff: false,
      bitmap: BufferUserPlanResearcher,
      groups: ['plan-researcher'],
    })
  })

  it('falls back to guest permissions when the user has no bitmap record', async () => {
    await createUser(2)

    const user = await loadExportingUser(db.sequelize, '2')

    assert.equal(user.bitmap, BufferUserPlanGuest)
    assert.deepEqual(user.groups, [])
  })

  it('reads the bitmap stored as a blob', async () => {
    await createUser(3)
    await db.sequelize.query('INSERT INTO impresso_userbitmap (user_id, bitmap) VALUES (?, ?)', {
      replacements: [3, bigIntToBuffer(BufferUserPlanResearcher)],
    })

    const user = await loadExportingUser(db.sequelize, '3')

    assert.equal(user.bitmap, BufferUserPlanResearcher)
  })

  it('rejects when the user does not exist', async () => {
    await assert.rejects(loadExportingUser(db.sequelize, '42'), /Active user 42 not found/)
  })

  it('rejects when the user is not active', async () => {
    await createUser(4, { isActive: false })
    await assert.rejects(loadExportingUser(db.sequelize, '4'), /Active user 4 not found/)
  })

  it('rejects an invalid user ID', async () => {
    await assert.rejects(loadExportingUser(db.sequelize, 'undefined'), /Invalid user ID/)
  })
})
