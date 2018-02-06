const { authenticate } = require('@feathersjs/authentication').hooks;
const { forwardStrategy, sanitize, validate, VALIDATE_OPTIONAL_GITHUB_ID, VALIDATE_OPTIONAL_EMAIL, VALIDATE_OPTIONAL_PASSWORD } = require('../../hooks/params');

const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks;

module.exports = {
  before: {
    all: [ sanitize() ],
    find: [
      sanitize({
        validators:{
          ...VALIDATE_OPTIONAL_EMAIL,
          ...VALIDATE_OPTIONAL_GITHUB_ID
        }
      }), authenticate('jwt') 
    ],
    get: [ authenticate('jwt') ],
    create: [ hashPassword(), validate({
      ...VALIDATE_OPTIONAL_EMAIL, 
      ...VALIDATE_OPTIONAL_PASSWORD,
      ...VALIDATE_OPTIONAL_GITHUB_ID
    })],
    update: [ hashPassword(),  authenticate('jwt') ],
    patch: [ hashPassword(),  authenticate('jwt') ],
    remove: [ authenticate('jwt') ]
  },

  after: {
    all: [ 
      // Make sure the password field is never sent to the client
      // Always must be the last hook
      protect('password')
    ],
    find: [
      
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};