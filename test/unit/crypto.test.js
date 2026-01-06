import assert from 'assert'
import { encrypt } from '@/crypto.js'

/**
 * use with
  ./node_modules/.bin/eslint test/crypto.test.js  \
  src/crypto.js --fix \
  && DEBUG=impresso/* mocha test/crypto.test.js
 */
describe('encrypt password as django does', () => {
  it('using django default parameters', () => {
    const result = encrypt('armada84', {
      salt: 'JN8F5rBKNpEg',
      iterations: 120000,
      length: 32,
      formatPassword: p => p, // identity
      encoding: 'base64',
    })
    assert.equal('JN8F5rBKNpEg', result.salt)
    assert.equal('LwibtC6lSSSAIUimQcRRjwPMB+No5g/eQRbhwsA++tQ=', result.password)
  })

  it('should encrypt password with custom salt', () => {
    const result = encrypt('armada84', {
      salt: '',
      iterations: 120000,
      length: 32,
      formatPassword: p => p, // identity
      encoding: 'base64',
    })
    assert.ok(result.salt.length > 0, 'returned salt should not be empty')
  })
})
