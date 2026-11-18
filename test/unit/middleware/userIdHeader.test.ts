import { strict as assert } from 'assert'
import type { Server } from 'node:http'
import { feathers, type HookContext } from '@feathersjs/feathers'
// Under NodeNext the default import of this CommonJS package is typed as the
// whole module, whose `default` member is the typed `feathersExpress` factory.
import feathersExpress, { errorHandler, rest, type Application } from '@feathersjs/express'
import { Forbidden } from '@feathersjs/errors'
import { userIdHeader, UserIdHeader } from '@/middleware/userIdHeader.js'

const setUser = (uid: string) => async (context: HookContext) => {
  context.params = { ...context.params, user: { uid, id: 1, isStaff: false, bitmap: 0n, groups: [] } }
}

const buildApp = (): Application => {
  const app = feathersExpress.default(feathers())
  app.use(userIdHeader())
  app.configure(rest())

  app.use('/authenticated', { find: async () => ({ ok: true }) })
  app.service('authenticated').hooks({ before: { find: [setUser('local-user-1')] } })

  app.use('/authenticated-error', {
    find: async () => {
      throw new Forbidden('nope')
    },
  })
  app.service('authenticated-error').hooks({ before: { find: [setUser('local-user-2')] } })

  app.use('/anonymous', { find: async () => ({ ok: true }) })

  app.use(errorHandler({ logger: false }))
  return app
}

describe('userIdHeader middleware', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    server = await buildApp().listen(0)
    const address = server.address()
    if (address == null || typeof address === 'string') throw new Error('Expected a TCP server address')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(done => {
    server.close(done)
  })

  it('returns the authenticated user uid on a successful response', async () => {
    const res = await fetch(`${baseUrl}/authenticated`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get(UserIdHeader), 'local-user-1')
  })

  it('returns the authenticated user uid on an error response', async () => {
    const res = await fetch(`${baseUrl}/authenticated-error`)
    assert.equal(res.status, 403)
    assert.equal(res.headers.get(UserIdHeader), 'local-user-2')
  })

  it('does not set the header when no user is authenticated', async () => {
    const res = await fetch(`${baseUrl}/anonymous`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get(UserIdHeader), null)
  })

  it('does not echo a user id sent by the client', async () => {
    const res = await fetch(`${baseUrl}/anonymous`, { headers: { [UserIdHeader]: 'spoofed' } })
    assert.equal(res.headers.get(UserIdHeader), null)
  })

  it('does not set the header for non-service routes', async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`)
    assert.equal(res.headers.get(UserIdHeader), null)
  })
})
