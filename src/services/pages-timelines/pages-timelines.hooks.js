const { validate, REGEX_UID } = require('../../hooks/params')

export default {
  before: {
    all: [],
    find: [],
    get: [
      validate({
        newspaper_uid: {
          required: false,
          regex: REGEX_UID,
        },
      }),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
