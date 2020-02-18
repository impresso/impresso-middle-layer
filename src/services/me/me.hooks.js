const { authenticate } = require('@feathersjs/authentication').hooks;
const { discard } = require('feathers-hooks-common');
const { REGEX_PASSWORD, validate } = require('../../hooks/params');
const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [],
    update: [
      validateWithSchema('services/me/schema/post/payload.json'),
      validate({
        pattern: {
          regex: /^#[a-f0-9]{2,6}$/,
          after: d => d.join(','),
        },
        firstname: {
          after: d => d.trim(),
        },
        lastname: {
          after: d => d.trim(),
        },
        email: {
          after: d => d.trim(),
        },
        displayName: {
          after: d => d.trim(),
        },
      }, 'POST'),
    ],
    patch: [
      validate({
        previousPassword: {
          required: false,
        },
        newPassword: {
          required: false,
          regex: REGEX_PASSWORD,
        },
      }, 'POST'),
    ],
    remove: [],
  },

  after: {
    all: [discard('password')],
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
