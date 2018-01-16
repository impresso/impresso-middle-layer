const { sanitize, verbose } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      sanitize({
        validators:{
          q: {
            required: true,
            min_length: 2,
            max_length: 1000
          }, 
        }
      })
    ],
    find: [],
  },

  after: {
    all: [
      verbose()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [
      
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
