
module.exports = {
  before: {
    all: [

    ], // authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [
      // normalize()
    ],
    find: [
      // finalizeMany()
    ],
    get: [
      // finalize()
    ],
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
