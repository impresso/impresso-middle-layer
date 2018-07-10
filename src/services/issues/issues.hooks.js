const { queryWithCommonParams } = require('../../hooks/params');

const proxyIIIF = () => async (context) => {
  const proxyhost = context.app.get('proxy').host;

  // for findAll
  if(Array.isArray(context.result)) {
    context.result = context.result.map((d) => ({
      ...d,
      cover: {
        ...d.cover,
        iiif: `${proxyhost}/proxy/iiif/${d.cover.uid}/info.json`,
      },
      iiif: `${proxyhost}/proxy/iiif/${d.cover.uid}/info.json`,
    }));
  } else if (context.result && context.result.cover) {
    context.result.iiif = `${proxyhost}/proxy/iiif/${context.result.cover.uid}/info.json`;
    context.result.cover.iiif = context.result.iiif;
  } else if (context.result && context.result.pages) {
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
