const { authenticate } = require('@feathersjs/authentication').hooks;
const { sanitize } = require('../../hooks/params');
const { normalize, finalize, finalizeMany } = require('../../hooks/neo4j');



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
            choices: ['-date', 'date', '-relevance', 'relevence']
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
      normalize(),
    ],
    find: [
      finalizeMany()
    ],
    get: [
      finalize()
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
