import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import authentication from '@/authentication.js'
import jwt from 'jsonwebtoken'
import { createReceipt, verifyReceipt, hashIds } from '@/util/provenance.js'
import { authSecret, config, keys, signingConfig } from '../../helpers/provenance.js'

describe('provenance/authentication isolation', () => {
  it('isolates receipts from API tokens sharing the same authentication root secret', async () => {
    const app = feathers<AppServices, Configuration>()
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
    const token = createReceipt({ kind: 'api', path: 'search', userRef: 'user', ...hashIds([]) }, signingConfig)
    const service = app.service('authentication')
    // Key derivation isolates signatures even if a receipt claims the API audience.
    await assert.rejects(service.create({ strategy: 'jwt', accessToken: token }))
    const disguisedReceipt = jwt.sign({ userId: 'user', sub: '1' }, keys.secret, {
      algorithm: 'HS256',
      audience: 'api',
      issuer: config.issuer,
    })
    await assert.rejects(service.create({ strategy: 'jwt', accessToken: disguisedReceipt }))
    // A correctly signed API token still cannot authenticate a receipt, even
    // when its audience and key ID are made to look like provenance.
    const apiToken = await service.createAccessToken({ userId: 'user', sub: '1' }, { keyid: keys.kid })
    await service.create({ strategy: 'jwt', accessToken: apiToken })
    assert.equal(verifyReceipt(apiToken, signingConfig).valid, false)
    const receiptClaims = jwt.decode(token)
    assert.ok(receiptClaims && typeof receiptClaims === 'object')
    const disguisedApiToken = jwt.sign(receiptClaims, authSecret, { algorithm: 'HS256', keyid: keys.kid })
    assert.equal(verifyReceipt(disguisedApiToken, signingConfig).valid, false)
  })
})
