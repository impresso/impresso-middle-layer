const debug = require('debug')('impresso/hooks:iiif');
const config = require('@feathersjs/configuration')()();

const _getIIIF = uid => `${config.proxy.host}/proxy/iiif/${uid}/info.json`;

const _IIIFmapper = (context, fromKey = 'uid', toKey = 'iiif') => (d) => {
  const _d = {
    ...d,
  };
  _d[toKey] = _getIIIF(d[fromKey]);
  return _d;
};

const IiifMapper = (d) => {
  const _d = {
    ...d,
  };
  if (d.labels.indexOf('page') !== -1) {
    _d.iiif = `${config.proxy.host}/proxy/iiif/${d.uid}`;
    _d.iiif_thumbnail = `${config.proxy.host}/proxy/iiif/${d.uid}/full/150,/0/default.png`;
  }
  if (d.labels.indexOf('issue') !== -1 && typeof d.cover === 'string') {
    _d.iiif = `${config.proxy.host}/proxy/iiif/${d.cover}`;
    _d.iiif_thumbnail = `${config.proxy.host}/proxy/iiif/${d.cover}/full/150,/0/default.png`;
  }
  return _d;
};

const assignIIIF = (...props) => async (context) => {
  if (!context.result) {
    throw new Error('The \'proxy\' hook should only be used with context.result');
  }

  const _recursiveReplace = (d) => {
    const _d = IiifMapper(d);
    
    props.forEach((key) => {
      if(_d[key]) {
        if (Array.isArray(_d[key])) {
          _d[key] = _d[key].map(IiifMapper);
        } else if (_d[key].constructor.name === 'Object') {
          _d[key] = IiifMapper(_d[key]);
        }
      }
    });
    return _d;
  };
  // find method
  if (context.method === 'find' && context.result.data && context.result.data.length) {
    debug(`proxy: <n. results>: ${context.result.data.length} <host>: ${config.proxy.host}, <keys>: ${props}`);
    context.result.data = context.result.data.map(_recursiveReplace);
  } else if (context.method === 'get' && typeof context.result.uid !== 'undefined') {
    debug(`proxy: <uid>: ${context.result.uid} <host>: ${config.proxy.host}, <keys>: ${props}`);
    context.result = _recursiveReplace(context.result);
  }
};

/**
 *
 */
const proxyIIIFWithMapper = (listName = 'items', _mapper) => async (context) => {
  const proxyhost = context.app.get('proxy').host;
  const proxyprefix = `${proxyhost}/proxy/iiif`;

  if (context.type !== 'after') {
    throw new Error('The \'proxyIIIFOnKey\' hook should only be used as a \'after\' hook.');
  }
  if (!context.result) {
    return;
  }
  if (Array.isArray(context.result[listName])) {
    context.result[listName] = context.result[listName].map(_mapper(proxyprefix));
  }
};

const proxyIIIFOnKey = (listName = 'items', fromKey = 'cover', toKey = 'iiif') => async (context) => {
  if (context.type !== 'after') {
    throw new Error('The \'proxyIIIFOnKey\' hook should only be used as a \'after\' hook.');
  }
  if (!context.result) {
    return;
  }
  if (context.result.data && Array.isArray(context.result.data[listName])) {
    context.result.data[listName] = context.result.data[listName]
      .map(_IIIFmapper(context, fromKey, toKey));
  }
};

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
      } else if (page.cover) {
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
  assignIIIF,
  proxyIIIFOnKey,
};
