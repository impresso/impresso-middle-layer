'use strict';

const debug = require('debug')('impresso/hooks:iiif');

const _getIIIF = (context, page__uid) => {
  const proxyhost = context.app.get('proxy').host;
  return `${proxyhost}/proxy/iiif/${page__uid}/info.json`
}

// use this hook to add IIIF endpoints that go well with IIIF proxy.
const proxyIIIF = () => {
  return async context => {
    if (context.type !== 'after') {
      throw new Error(`The 'proxyIIIF' hook should only be used as a 'after' hook.`);
    }

    if (context.result && context.result.uid) {
      debug(`proxyIIIF: <uid>: ${context.result.uid}`);
      context.result.iiif = _getIIIF(context, context.result.uid)
    } else if (context.result.data) {
      debug(`proxyIIIF: with result.data <length>: ${context.result.data.length}`);
      for (let page of context.result.data) {
        if(page.labels.indexOf('page') !== -1) {
          page.iiif = _getIIIF(context, page.uid)
        } else if(Array.isArray(page.pages)) {
          for (let relatedpage of page.pages) {
            relatedpage.iiif = _getIIIF(context, relatedpage.uid);
          }
        }
      }
    } else {
      debug('proxyIIIF: unable to find an UID to generate the IIIF')
    }
    // if(context.result) {
    //
    //   console.log(context.result);
    //   //
    //   // for(let i in context.result.pages) {
    //   //   context.result.pages[i].iiif =
    //   // }
    // }
  }
}


module.exports = {
  proxyIIIF,
}
