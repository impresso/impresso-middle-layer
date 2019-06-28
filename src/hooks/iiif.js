const debug = require('debug')('impresso/hooks:iiif');
const config = require('@feathersjs/configuration')()();

const endpoint = `${config.proxy.host}/proxy/iiif`;

const getJSON = uid => `${endpoint}/${uid}/info.json`;
const getThumbnail = (uid, { dim = '150,' } = {}) => `${endpoint}/${uid}/full/${dim}/0/default.png`;
const getExternalThumbnail = (iiifManifest, { dim = '150,' } = {}) => {
  const externalUid = iiifManifest.split('/info.json').shift();
  return `${externalUid}/full/${dim}/0/default.png`;
};

const getFragment = (uid, { coords, dim = 'full' } = {}) => `${endpoint}/${uid}/${coords.join(',')}/${dim}/0/default.png`;
const getExternalFragment = (iiifManifest, { coords, dim = 'full' } = {}) => {
  const externalUid = iiifManifest.split('/info.json').shift();
  return `${externalUid}/${coords.join(',')}/${dim}/0/default.png`;
};

const _IIIFmapper = (context, fromKey = 'uid', toKey = 'iiif') => (d) => {
  const _d = {
    ...d,
  };
  _d[toKey] = getJSON(d[fromKey]);
  return _d;
};

const IiifMapper = (d) => {
  const _d = {
    ...d,
  };

  if (d.pageUid && Array.isArray(d.coords)) {
    // fragments matches from SOLR
    _d.iiif_fragment = `${config.proxy.host}/proxy/iiif/${d.pageUid}/${d.coords.join(',')}/full/0/default.png`;
    _d.iiifFragment = _d.iiif_fragment;
  } else if (!d.labels) {
    // non canonical neo4j objects, ignore...
  } else if (d.labels.indexOf('issue') !== -1 && d.cover && d.cover.uid) {
    // issue with cover page ;)
    _d.iiif = `${config.proxy.host}/proxy/iiif/${d.cover.uid}`;
    _d.iiifThumbnail = `${config.proxy.host}/proxy/iiif/${d.cover.uid}/full/350,/0/default.png`;
    _d.cover.iiif = `${config.proxy.host}/proxy/iiif/${d.cover.uid}`;
    _d.cover.iiifThumbnail = `${config.proxy.host}/proxy/iiif/${d.cover.uid}/full/150,/0/default.png`;
  } else if (d.labels.indexOf('page') !== -1) {
    _d.iiif = `${config.proxy.host}/proxy/iiif/${d.uid}`;
    _d.iiifThumbnail = `${config.proxy.host}/proxy/iiif/${d.uid}/full/150,/0/default.png`;
  } else if (d.labels.indexOf('issue') !== -1 && typeof d.cover === 'string') {
    _d.iiif = `${config.proxy.host}/proxy/iiif/${d.cover}`;
    _d.iiifThumbnail = `${config.proxy.host}/proxy/iiif/${d.cover}/full/350,/0/default.png`;
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
      if (_d[key]) {
        if (Array.isArray(_d[key])) {
          _d[key] = _d[key].map(IiifMapper);
        } else if (_d[key].constructor.name === 'Object') {
          _d[key] = IiifMapper(_d[key]);
        }
      }
    });
    return _d;
  };
  if (context.method === 'find' && context.result.data && context.result.data.length) {
    debug(`proxy: <n. results>: ${context.result.data.length} <host>: ${config.proxy.host}, <keys>: ${props}`);
    context.result.data = context.result.data.map(_recursiveReplace);
  } else if (context.method === 'get' && typeof context.result.uid !== 'undefined') {
    debug(`proxy: <uid>: ${context.result.uid} <host>: ${config.proxy.host}, <keys>: ${props}`);
    context.result = _recursiveReplace(context.result);
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


module.exports = {
  // proxyIIIF,
  // proxyIIIFWithMapper,
  assignIIIF,
  proxyIIIFOnKey,
  getJSON,
  getThumbnail,
  getFragment,
  getExternalThumbnail,
  getExternalFragment,
};
