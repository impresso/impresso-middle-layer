

const debug = require('debug')('impresso/hooks:iiif');

const _getIIIF = (context, pageUid) => {
  const proxyhost = context.app.get('proxy').host;
  return `${proxyhost}/proxy/iiif/${pageUid}/info.json`;
};

const _IIIFmapper = (context, fromKey='uid', toKey='iiif') => (d) => {
  const _d = {
    ...d,
  }
  _d[toKey] = _getIIIF(context, d[fromKey]);
  return _d
}

/**
 *
 */
const proxyIIIFWithMapper = (listName='items', _mapper = (prefixer) => (d) => d) => async (context) => {


  const proxyhost = context.app.get('proxy').host;
  const proxyprefix =`${proxyhost}/proxy/iiif`;

  if (context.type !== 'after') {
    throw new Error('The \'proxyIIIFOnKey\' hook should only be used as a \'after\' hook.');
  }
  if(!context.result) {
    return;
  }
  if(Array.isArray(context.result[listName])) {
    context.result[listName] = context.result[listName].map(_mapper(proxyprefix));
  }
}

const proxyIIIFOnKey = (listName='items', fromKey='cover', toKey='iiif') => async (context) => {
  if (context.type !== 'after') {
    throw new Error('The \'proxyIIIFOnKey\' hook should only be used as a \'after\' hook.');
  }
  if(!context.result) {
    return;
  }
  if (context.result.data && Array.isArray(context.result.data[listName])) {
    context.result.data[listName] = context.result.data[listName].map(_IIIFmapper(context, fromKey, toKey));
  }
}

// use this hook to add IIIF endpoints that go well with IIIF proxy.
const proxyIIIF = () => async (context) => {
  if (context.type !== 'after') {
    throw new Error('The \'proxyIIIF\' hook should only be used as a \'after\' hook.');
  }

  if (context.result && context.result.uid) {
    debug(`proxyIIIF: <uid>: ${context.result.uid}`);
    context.result.iiif = _getIIIF(context, context.result.uid);
  } else if (context.result.data) {
    debug(`proxyIIIF: with result.data <length>: ${context.result.data.length}`);

    for (const page of context.result.data) {
      if (!page.labels) {
        // not a neo4j
        continue;
      }
      if (page.labels.indexOf('page') !== -1) {
        page.iiif = _getIIIF(context, page.uid);
      } else if (Array.isArray(page.pages)) {
        for (const relatedpage of page.pages) {
          relatedpage.iiif = _getIIIF(context, relatedpage.uid);
        }
      } else if(page.cover) {
        page.cover = _getIIIF(context, page.cover);
      }
    }
  } else {
    debug('proxyIIIF: unable to find an UID to generate the IIIF');
  }
  // if(context.result) {
  //
  //   console.log(context.result);
  //   //
  //   // for(let i in context.result.pages) {
  //   //   context.result.pages[i].iiif =
  //   // }
  // }
};


module.exports = {
  proxyIIIF,
  proxyIIIFWithMapper,
};
