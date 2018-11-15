const { authenticate } = require('@feathersjs/authentication').hooks;
const { validate, REGEX_UID } = require('../../hooks/params');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [
      validate({
        article_uid: {
          required: true,
          regex: REGEX_UID,
        },
        tag: {
          required: true,
          max_length: 100,
          // check unicode table order: https://unicode-table.com/en/
          regex: /^[0-9A-zÀ-ÿ\s,:;?!]+$/,
        },
      }, 'POST'),
    ],
    update: [],
    patch: [],
    remove: [
      validate({
        tag_uid: {
          required: true,
          regex: REGEX_UID,
        },
      }, 'GET'),
    ],
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
};
