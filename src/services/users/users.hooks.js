const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  queryWithCommonParams, validate, VALIDATE_OPTIONAL_GITHUB_ID,
  VALIDATE_OPTIONAL_EMAIL, VALIDATE_OPTIONAL_PASSWORD, REGEX_SLUG,
} = require('../../hooks/params');

const { protect } = require('@feathersjs/authentication-local').hooks;

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        ...VALIDATE_OPTIONAL_EMAIL,
        ...VALIDATE_OPTIONAL_GITHUB_ID,
      }),
      queryWithCommonParams(),
      // last not to be bothered with unvalid parameters
      authenticate('jwt'),
    ],
    get: [authenticate('jwt')],
    create: [
      authenticate('jwt'), // comment to activate public subscriptions
      validate({
        username: {
          required: false,
          regex: REGEX_SLUG,
          max_length: 20,
        },
        ...VALIDATE_OPTIONAL_EMAIL,
        ...VALIDATE_OPTIONAL_PASSWORD,
        ...VALIDATE_OPTIONAL_GITHUB_ID,
      }, 'POST'),
    ],
    update: [
      // hashPassword(),
      authenticate('jwt'),
    ],
    patch: [
      // hashPassword(),
      //
      authenticate('jwt'),
      validate({
        ...VALIDATE_OPTIONAL_PASSWORD,
      }, 'POST'),
    ],
    remove: [authenticate('jwt')],
  },

  after: {
    all: [
      // Make sure the password field is never sent to the client
      // Always must be the last hook
      protect('password'),
      protect('salt'),


    ],
    find: [
    ],
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
