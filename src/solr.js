const rp = require('request-promise');
const { Unavailable, NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/solr');
const _ = require('lodash');

/**
 * request wrapper to get results from solr.
 * @param {object} config - config object for solr
 * @param {object} params - `q` with lucene search query; `limit` and `offset`
 */
const findAll = (config, params={}) => {
  params = {
    q: '*:*',
    limit: 10,
    skip: 0,
    excerptLength: 30,
    ... params
  }

  let qs = {
    q: params.q,
    start: params.skip,
    rows: params.limit,
    wt: 'json',
    //wt: 'xml'
  }

  // transform facets if any
  //
  if(params.facets) {
    qs['json.facet'] = params.facets
  }

  debug(`'findAll' request with 'qs':`, qs);

  return rp({
    url: `${config.endpoint}`,
    auth: config.auth,
    qs: qs,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    // dummy handle dupes keys
    const result = JSON.parse(res.replace('"highlighting":{', '"fragments":{'));
    // console.log(result)
    // map doc array to get proper highlights and pages in document itself.
    result.response.docs = result.response.docs.map((d) => {
      let doc = {
        uid: d.id,
        language: d.lg_s,
        title: d.title_txt_fr,
        year: d.meta_year_i,
      };

      // parse
      const _fragments = result.fragments[doc.uid].content_txt_fr;
      const _highlights = result.highlighting[doc.uid].content_txt_fr;
      const _content_boxes_plain = JSON.parse(d.content_boxes_plain);

      doc.excerpt = d.content_txt_fr.split(' ', params.excerptLength)
        .slice(0, params.excerptLength-1).join(' ');

      // align highlights and fragments
      doc.matches = _highlights.offsets.map((pos, i) => {
        let _p = {}

        for(let j in _content_boxes_plain) {
          let pag = _content_boxes_plain[j];
          let pagId = pag.id.replace('.json','');

          for(let l=pag.regions.length, ii=0; ii < l; ii++) {
            if(pos[0] == pag.regions[ii].start) {
              _p = {
                n: pag.n,
                pos: pos[0],
                page_uid: pagId,
                fragment: _fragments[i],
                coords: pag.regions[ii].coords,
                _iiif: `https://api-impresso.uni.lu/proxy/iiif/${pagId}/${pag.regions[ii].coords.join(',')}/full/0/default.jpg`
              }
              break;
            }
          }
        }
        return _p;

      });
      return doc
    });

    return result;
  }).catch((err) => {
    console.log(err);
    throw new NotImplemented();
    // throw feathers errors here.
  });
  return results;
}


const getSolrClient = config => {
  return {
    findAll: params => findAll(config, params)
  }
}

module.exports = function (app) {
  const config = app.get('sequelize');
  const solr = getSolrClient(config);
}

module.exports.client = getSolrClient;
