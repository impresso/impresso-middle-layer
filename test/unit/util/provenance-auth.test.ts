import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import authentication from '@/authentication.js'
import { createReceipt, verifyReceipt, hashIds } from '@/util/provenance.js'
import { config } from '../../helpers/provenance.js'

describe('provenance/authentication isolation', () => {
  it('rejects provenance receipts through the API authentication service even with a shared test key', async () => {
    const app = feathers<AppServices, Configuration>()
    assert.ok(config.privateKey)
    app.set('authentication', {
      secret: config.privateKey,
      entity: 'user',
      service: 'users',
      authStrategies: ['jwt'],
      local: { usernameField: 'email', passwordField: 'password' },
      jwtOptions: { algorithm: 'RS256', audience: 'api', issuer: config.issuer },
      useDbUserInRequestContext: false,
    })
    app.configure(authentication)
    const token = createReceipt({ kind: 'api', path: 'search', userRef: 'user', ...hashIds([]) }, config)
    const service = app.service('authentication')
    // An intentionally shared key proves audience enforcement, independently of key separation.
    await assert.rejects(service.create({ strategy: 'jwt', accessToken: token }))
    const apiToken = await service.createAccessToken({ userId: 'user', sub: '1' }, { keyid: config.activeKid })
    await service.create({ strategy: 'jwt', accessToken: apiToken })
    assert.equal(verifyReceipt(apiToken, config).valid, false)
  })
})
