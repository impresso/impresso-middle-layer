const auth = require('@feathersjs/authentication');
const { authenticate } = auth.hooks;

const {sanitize, validate, VALIDATE_UIDS, REGEX_UID } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      authenticate('jwt'),
      sanitize()
    ], // authenticate('jwt') ],
    find: [
      validate({
        // the bucket owner uid
        owner_uid: {
          required: false,
          min_length: 3,
          regex: REGEX_UID
        },
      })
    ],
    get: [
      validate({
        // the bucket owner uid
        owner_uid: {
          required: false,
          min_length: 3,
          regex: REGEX_UID
        },
      })
    ],
    create: [
      validate({
        // request must contain a name - from which we will create a UID
        name: {
          required: true,
          min_length: 3,
          max_length : 50
        },
        // the bucket owner uid, optional. Default to current authenticated user.
        owner_uid: {
          required: false,
          min_length: 3,
          regex: REGEX_UID
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
