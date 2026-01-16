import assert from 'assert'
import app from '@/app'
import { generateUser, removeGeneratedUser } from './utils'

/*
 ./node_modules/.bin/eslint  \
 test/services/collections.test.js \
 src/services/collection src/models/user-collection.js \
 --config .eslintrc.json --fix \
 && NODE_ENV=test DEBUG=impresso* mocha test/services/collections.test.js
*/
const user = {
  username: 'local-user-test-only',
  password: 'Impresso2018!',
  email: 'local-user-test-only@impresso-project.ch',
}

const collection = {
  uid: 'this-is-random-collection-id',
  name: 'a nice name',
  description: 'digitus',
}

describe("'collections' service", function () {
  this.timeout(15000)

  let service

  before(async () => {
    service = app.service('collections')

    const result = await generateUser(user)
    assert.ok(result.uid, 'should have an uid prop')
    assert.ok(result.id, 'should have an id')
    assert.equal(result.username, user.username)
    // enrich the user variable
    user.uid = result.uid
    user.id = result.id
    // runs before all tests in this block
  })

  after(async () => {
    await removeGeneratedUser(user)
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('create, edit then remove a collection', async () => {
    console.log('create a collection', user)
    const created = await service.create(collection, {
      user,
    })

    const patched = await service.patch(
      created.uid,
      {
        name: 'a new name',
        description: '',
      },
      {
        user,
      }
    )
    assert.deepEqual(patched.uid, created.uid)
    assert.deepEqual(patched.name, 'a new name')

    const getted = await service.get(created.uid, {
      user,
    })
    assert.ok(getted.name, 'a new name')

    const found = await service.find({
      user,
      query: {
        q: 'new',
      },
    })
    assert.deepEqual(found.data[0].uid, created.uid)

    const removed = await service.remove(created.uid, {
      user,
    })

    await service
      .get(created.uid, {
        user,
      })
      .catch(err => {
        assert.deepEqual(err.name, 'NotFound')
      })

    assert.deepEqual(removed.uid, created.uid)
    assert.deepEqual(removed.status, 'DEL')
  })
})
