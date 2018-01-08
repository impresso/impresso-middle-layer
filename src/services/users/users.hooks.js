const { authenticate } = require('@feathersjs/authentication').hooks;
const commonHooks = require('feathers-hooks-common');
const { restrictToOwner } = require('feathers-authentication-hooks');

const { hashPassword } = require('@feathersjs/authentication-local').hooks;
const restrict = [
  authenticate('jwt'),
  restrictToOwner({
    idField: 'id',
    ownerField: 'id'
  })
];

const gravatar = require('../../hooks/gravatar');

module.exports = {
  before: {
    all: [],
    find: [  ],
    get: [ ...restrict ],
    create: [authenticate('jwt'), hashPassword(), gravatar()],
    update: [ ...restrict, hashPassword() ],
    patch: [ ...restrict, hashPassword() ],
    remove: [ ...restrict ]
  },

  after: {
    all: [
      commonHooks.when(
        hook => hook.params.provider,
        commonHooks.discard('password')
      )
    ],
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
