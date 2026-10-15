import { strict as assert } from 'assert'
import { feathers, createContext, type HookContext } from '@feathersjs/feathers'
import { http } from '@feathersjs/transport-commons'
import authentication from '@/authentication.js'
import search from '@/services/search/search.service.js'
import { authenticateAround } from '@/hooks/authenticate.js'
import type { FindParams } from '@/services/content-items/content-items.class.js'
import type { AppServices, ImpressoApplication } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { provenance } from '@/hooks/provenance.js'
import { verifyReceipt, hashIds } from '@/util/provenance.js'
import { authSecret, config, signingConfig } from '../../helpers/provenance.js'

const makeContext = (): HookContext<ImpressoApplication> => {
  const app = feathers<AppServices, Configuration>()
  app.set('provenance', { ...config })
  app.set('authentication', { secret: authSecret, jwtOptions: { audience: 'api' } })
  app.set('isPublicApi', true)
  return {
    arguments: [],
    event: null,
    toJSON() {
      return this
    },
    app,
    path: 'search',
    method: 'find',
    type: 'after',
    params: { provider: 'rest', user: { uid: 'user' } },
    result: { data: [{ id: 'b' }, { id: 'a' }], pagination: { total: 2, limit: 2, offset: 0 } },
    service: { isInternalService: false },
  }
}
describe('find provenance hook', () => {
  it('returns the search receipt in HTTP headers when authentication occurs during delegation', async () => {
    const app = makeContext().app
    app.set('authentication', {
      secret: authSecret,
      entity: 'user',
      service: 'users',
      authStrategies: ['jwt'],
      local: { usernameField: 'email', passwordField: 'password' },
      jwtOptions: { algorithm: 'HS256', audience: 'api', issuer: config.issuer },
      useDbUserInRequestContext: false,
    })
    app.configure(authentication)
    app.use('/content-items', {
      async find(_params: FindParams) {
        return { data: [{ id: 'b' }, { id: 'a' }], pagination: { total: 2, limit: 2, offset: 0 } }
      },
    })
    app.service('content-items').hooks({ around: { find: [authenticateAround({ allowUnauthenticated: true })] } })
    app.configure(search)
    app.hooks({ after: { find: [provenance] } })
    const accessToken = await app.service('authentication').createAccessToken({ userId: 'user', sub: '1' })
    const service = app.service('search')
    // Invoke the service exactly as the REST transport does, including its hook context.
    const context: HookContext<ImpressoApplication> = await Reflect.apply(service.find, service, [
      { provider: 'rest', headers: {}, authentication: { strategy: 'jwt', accessToken } },
      createContext(service, 'find', { http: {} }),
    ])
    const response = http.getResponse(context)
    const token = response.headers['X-Impresso-Provenance']
    assert.ok(typeof token === 'string')
    assert.equal(token, response.body.meta.provenance.token)
    const verified = verifyReceipt(token, signingConfig)
    assert.ok(verified.valid)
    assert.equal(verified.claims.path, 'search')
    assert.equal(verified.claims.userRef, 'user')
    assert.equal(verified.claims.idsHash, hashIds(['b', 'a']).idsHash)
  })

  it('adds receipts for authenticated calls regardless of provider', () => {
    for (const provider of ['socketio', undefined]) {
      const context = makeContext()
      context.params.provider = provider

      provenance(context)

      const token = context.result.meta.provenance.token
      const verified = verifyReceipt(token, signingConfig)
      assert.ok(verified.valid)
      assert.equal(verified.claims.idsHash, hashIds(['b', 'a']).idsHash)
      assert.equal(context.http?.headers?.['X-Impresso-Provenance'], token)
    }
  })

  it('skips webapp, disabled, unauthenticated, noncovered, internal-service, and nonpaginated calls', () => {
    const contexts = Array.from({ length: 6 }, makeContext)
    contexts[0].app.set('provenance', { ...config, enabled: false })
    delete contexts[1].params.user
    contexts[2].path = 'topics'
    contexts[3].service.isInternalService = true
    contexts[4].result = []
    contexts[5].app.set('isPublicApi', false)
    for (const context of contexts) {
      provenance(context)
      assert.equal(context.http, undefined)
      assert.ok(!context.result.meta)
    }
  })
  it('fails covered responses when signing or ID hashing fails', () => {
    const context = makeContext()
    context.app.set('authentication', { secret: '' })
    assert.throws(() => provenance(context))
    assert.ok(!context.result.meta)
    context.app.set('authentication', { secret: authSecret })
    context.result.data[0].id = ''
    assert.throws(() => provenance(context))
  })
})
