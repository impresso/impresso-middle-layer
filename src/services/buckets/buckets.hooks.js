const { authenticate } = require('@feathersjs/authentication').hooks;
const {sanitize, validate, VALIDATE_UIDS } = require('../../hooks/params');

module.exports = {
  before: {
    all: [ sanitize() ], // authenticate('jwt') ],
    find: [],
    get: [],
    create: [
      validate({
        // must contain a name - from which we will create a UID
        name: {
          required: true,
          min_length: 3,
          max_length : 50
        },
        // optionally
        description: {
          required: false,
          max_length : 500
        },
        // MUST contain a service label
        label:{
          required: true,
          choices: ['article']
        },
        // MUST contain uids for the given label
        ... VALIDATE_UIDS
      })
    ],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
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
