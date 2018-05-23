const { authenticate } = require('@feathersjs/authentication').hooks;
const { sanitize } = require('../../hooks/params');
const { proxyIIIF } = require('../../hooks/iiif');


module.exports = {
  before: {
    all: [
      sanitize({
        validators:{
          q: {
            min_length: 2,
            max_length: 1000
          },
          order_by: {
            choices: ['-date', 'date', '-relevance', 'relevance']
          }
        }
      })
    ],//authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [

    ],
    find: [
      proxyIIIF()
    ],
    get: [
    ],
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
