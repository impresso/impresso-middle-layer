const rp = require('request-promise');
const { NotImplemented } = require('@feathersjs/errors');
const debug = require('debug')('impresso/solr');

/**
 * request wrapper to get results from solr.
 * TODO Check grouping: https://lucene.apache.org/solr/guide/6_6/result-grouping.html
 * @param {object} config - config object for solr
 * @param {object} params - `q` with lucene search query; `limit` and `offset`
 */
const findAll = (config, params = {}) => {
  const _params = {
    q: '*:*',
    limit: 10,
    skip: 0,
    excerptLength: 30,
    ...params,
  };

  const qs = {
    q: _params.q,

    start: _params.skip,
    rows: _params.limit,
    wt: 'json',
    // wt: 'xml'
  };

  // transform order by if any
  if (_params.order_by) {
    qs['sort'] = _params.order_by;
  }

  // transform facets if any
  //
  if (_params.facets) {
    qs['json.facet'] = _params.facets;
  }
  if (_params.fl) {
    qs.fl = _params.fl;
  }

  debug('\'findAll\' request with \'qs\':', qs);

  return rp({
    url: `${config.endpoint}`,
    auth: config.auth,
    qs,
    // json: true REMOVED because of duplicate keys
  }).then((res) => {
    // dummy handle dupes keys
    const result = JSON.parse(res.replace('"highlighting":{', '"fragments":{'));
    // console.log(result)
    // map doc array to get proper highlights and pages in document itself.
    result.response.docs = result.response.docs.map((d) => {
      const doc = {
        uid: d.id,
        language: d.lg_s,
        title: d.title_txt_fr,
        year: d.meta_year_i,
        newspaper_uid: d.meta_journal_s,
        pages: d.page_id_ss,
      };

      // parse
      const _fragments = result.fragments[doc.uid].content_txt_fr;
      const _highlights = result.highlighting[doc.uid].content_txt_fr;

      if (d.content_txt_fr) {
        doc.excerpt = d.content_txt_fr.split(' ', params.excerptLength)
          .slice(0, params.excerptLength - 1).join(' ');
      }
      if (!d.content_boxes_plain) {
        return doc;
      }

      const _contentBoxesPlain = JSON.parse(d.content_boxes_plain);

      // align highlights and fragments
      doc.matches = _highlights.offsets.map((pos, i) => {
        let _p = {};

        for (let jl = _contentBoxesPlain.length, j = 0; j < jl; j += 1) {
          const pag = _contentBoxesPlain[j];
          const pagId = pag.id.replace('.json', '');

          for (let l = pag.regions.length, ii = 0; ii < l; ii += 1) {
            if (pos[0] === pag.regions[ii].start) {
              _p = {
                n: pag.n,
                pos: pos[0],
                page_uid: pagId,
                fragment: _fragments[i],
                coords: pag.regions[ii].coords,
                iiif: `https://api-impresso.uni.lu/proxy/iiif/${pagId}/${pag.regions[ii].coords.join(',')}/full/0/default.jpg`,
              };
              break;
            }
          }
        }
        return _p;
      });
      return doc;
    });

    return result;
  }).catch((err) => {
    debug(err);
    throw new NotImplemented();
    // throw feathers errors here.
  });
};


const getSolrClient = config => ({
  findAll: params => findAll(config, params),
});

module.exports = function (app) {
  const config = app.get('sequelize');
  const solr = getSolrClient(config);
  app.set('solrClient', solr);
};

module.exports.client = getSolrClient;
