const crypto = require('crypto');

const parseBase64EncryptedPassword = (encrypted) => {
  const parts = encrypted.split('$');

  
}

const comparePassword = (password, encrypted, options) => {
  const enc = encrypt(password, options);
  return enc.password === encrypted;
}

const encrypt = (password, options) => {
  const configs = {
    salt: crypto.randomBytes(16).toString('hex'),
    iterations: 4096,
    length: 256,
    digest: 'sha256',
    encoding: 'hex',
    ...options,
  };

  if (typeof configs.formatPassword !== 'function') {
    // default concatenation with double column
    configs.formatPassword = (p, c) => `${c.secret}::${c.salt}::${p}`;
  }

  return {
    salt: configs.salt,
    password: crypto.pbkdf2Sync(
      configs.formatPassword(password, configs),
      configs.salt,
      configs.iterations,
      configs.length,
      configs.digest,
    ).toString(configs.encoding),
  };
};

module.exports = {
  encrypt,
  comparePassword,
};
