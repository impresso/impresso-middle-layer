const crypto = require('crypto');

const encrypt = (password, options) => {
  const configs = {
    secret: '',
    salt: crypto.randomBytes(16).toString('hex'),
    iterations: 4096,
    length: 256,
    digest: 'sha256',
  };
  if (options) {
    Object.assign(configs, options || {});
  }

  return {
    salt: configs.salt,
    password: crypto.pbkdf2Sync(
      configs.secret,
      `${configs.salt}::${password}`,
      configs.iterations,
      configs.length,
      configs.digest,
    ).toString('hex'),
  };
};

const comparePassword = (password, encrypted, salt, secret) => encrypt(password, { salt, secret }).password == encrypted;

module.exports = {
  encrypt,
  comparePassword,
};
