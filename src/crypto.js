import crypto from 'crypto'

export const encrypt = (password, options) => {
  const configs = {
    iterations: 4096,
    length: 256,
    digest: 'sha256',
    encoding: 'hex',
    ...options,
  }
  if (typeof configs.salt !== 'string' || configs.salt.length === 0) {
    configs.salt = crypto.randomBytes(16).toString(configs.encoding)
  }

  if (typeof configs.formatPassword !== 'function') {
    // default concatenation with double column
    configs.formatPassword = (p, c) => `${c.secret}::${c.salt}::${p}`
  }

  return {
    salt: configs.salt,
    password: crypto
      .pbkdf2Sync(
        configs.formatPassword(password, configs),
        configs.salt,
        configs.iterations,
        configs.length,
        configs.digest
      )
      .toString(configs.encoding),
  }
}

export const comparePassword = (password, encrypted, options) => {
  const enc = encrypt(password, options)
  return enc.password === encrypted
}

export const generateHash = obj => {
  const hash = JSON.stringify(obj).split('').sort().join('')

  return crypto.createHmac('sha256', '').update(hash).digest('hex')
}
