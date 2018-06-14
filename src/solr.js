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
    offset: 0,
    excerptLength: 30,
    ... params
  }

  let qs = {
    q: params.q,
    start: params.offset,
    rows: params.limit,
    wt: 'json'
    //wt: 'xml'
  }

  // transform facets if any
  //
  if(params.facets) {
    qs['json.facet'] = JSON.stringify({
      years : {
        type : 'terms',
        field : 'meta_year_i',
        mincount : 1
      },
      language : {
        type : 'terms',
        field : 'lg_s',
        mincount : 1
      },
      date : {
        type : 'terms',
        field : 'meta_day_i',
        mincount : 1
      }
    })
    // qs.facet = true;
    // qs['facet.field'] = 'meta_year_i'
    // //, 'lg_s']
    // qs['facet.mincount'] = 1
  }

  console.log(qs);

  return rp({
    url: `${config.endpoint}`,
    auth: config.auth,
    qs: qs,
    //json: true
  }).then((res) => {
    // dummy handle dupes keys
    const result = JSON.parse(res.replace('"highlighting":{', '"fragments":{'));
    // res.lastIndexOf('"highlighting":{')
    //console.log(result);
    // throw new Unavailable();
    console.log(result.highlighting);

    // map doc array to get proper highlights and pages in document itself.
    const docs = result.response.docs.map((d) => {
      console.log();
      //
      console.log(Object.keys(d))//.name);

      let doc = {
        uid: d.id,
        language: d.lg_s,
        title: d.title_txt_fr,
        year: d.meta_year_i,
      };

      const _fragments = result.fragments[doc.uid].content_txt_fr;
      const _highlights = result.highlighting[doc.uid].content_txt_fr;

      const _content_boxes_plain = JSON.parse(d.content_boxes_plain);

      console.log(_highlights, _fragments)
      doc.excerpt = d.content_txt_fr.split(' ', params.excerptLength)
        .slice(0, params.excerptLength-1).join(' ');

      // align highlights and fragments
      doc.matches = _highlights.positions.map(pos => {
        let _p = {}

        for(var i in _content_boxes_plain) {
          let pag = _content_boxes_plain[i];
          let regions = pag.regions.filter((reg) => {
            return pos >= reg.start && pos <= reg.start + reg.length
          });

          if(regions.length) {
            _p = {
              n: pag.n,
              pos: pos,
              page_uid: pag.id.replace('.json',''),
              fragment: _fragments[i],
              regions
            }
            break;
          }
        }
        return _p;

      })
      // console.log(tokens)
      //
      // const _fragments = fragments
      //   .filter(fra => fra.name == doc.uid)
      //   .reduce((flat, fra) => flat.concat(fra.arr.str),[]);
      //
      //
      // doc.matches = highlights
      //   .filter(hig => hig.name == doc.uid)
      //   .map(hig => {
      //     // lst[0] should be the one named 'content_txt_fr'.
      //     let positions = hig.lst[0].arr[1].int;
      //     // console.log(hig.name, hig.lst[2])
      //     if(!Array.isArray(positions)) {
      //       positions = [ positions ];
      //     }
      //
      //     positions = positions.map((p, i) => {
      //       // search position in cbp. Positions are calculated on the whole article
      //       //  enven if it spans on more than 1 page.
      //       let _p = {}
      //
      //       cbp.forEach(pag => {
      //         const regions = pag.regions.filter(reg => p >= reg.start && p <= reg.start + reg.length);
      //         if(regions.length) {
      //           _p = {
      //             n: pag.n,
      //             id: pag.id,
      //             fragment: _fragments[i],
      //             regions
      //           }
      //         }
      //       });
      //
      //       return _p;
      //     });
      //
      //
      //     return positions;
      //   })
      //   .reduce((flat, match) => flat.concat(match),[]);


      // fragments.forEach(f => {
      //
      //   if(f.name == doc.uid){
      //     // console.log(f.arr);
      //     // { name: 'content_txt_fr',
      //     // str:
      //     //  [ 'La lettre du jour „ , A PROPOS DE MÉDECINS-DENTISTES DE SERVICE &lt;em&gt;Monsieur&lt;/em&gt; le Rédacteur , En réponse',
      //     //    'Veuillez agréer . &lt;em&gt;Monsieur&lt;/em&gt; le Rédac- t * ur , l\'assurance de nos sentiments dis- tingués Le Comité' ] }
      //     // and yes, apparently str it can be either a str or an array ... :D
      //     if(Array.isArray(f.arr.str)) {
      //       doc.matches = doc.matches.concat(f.arr.str);
      //     } else {
      //        doc.matches.push(f.arr.str);
      //     }
      //   }
      // });

      // console.log(doc)
      return doc
    });

    return {
      response: {
        numFound: parseInt(result.response.numFound),
        docs: docs
      }
    }
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
