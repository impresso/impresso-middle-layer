const { queryWithCommonParams } = require('../../hooks/params');

const proxyIIIF = () => async (context) => {
  if (context.result && context.result.pages) {
    const proxyhost = context.app.get('proxy').host;
    for (const i in context.result.pages) {
      context.result.pages[i].iiif = `${proxyhost}/proxy/iiif/${context.result.pages[i].uid}/info.json`;
    }
  }
};


module.exports = {
  before: {
    all: [
      queryWithCommonParams(),
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [
      // change count_pages
      proxyIIIF(),
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
