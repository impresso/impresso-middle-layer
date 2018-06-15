const { validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID, REGEX_UIDS, utils} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { proxyIIIF } = require('../../hooks/iiif');

const SOLR_FACETS = {
  year : {
    type : 'terms',
    field : 'meta_year_i',
    mincount : 1,
    limit: 400
  },
  newspaper:{
    type: 'terms',
    field: 'meta_journal_s',
    mincount: 1,
    maxcount: 750
  },
  date: {
    type: 'terms',
    field: 'meta_date_dt',
    mincount : 1,
    limit: 100
  },
  language : {
    type : 'terms',
    field : 'lg_s',
    mincount : 1
  },
}


module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        group_by: {
          required: true,
          choices: ['articles', 'pages'],
        },
        order_by: {
          choices: ['-date', 'date', '-relevance', 'relevance'],
        },
        facets: {
          before: (d) => {
            if(typeof d == 'string') {
              return d.split(',');
            }
            return d;
          },
          choices: Object.keys(SOLR_FACETS),
          after: (fields) => {
            let _facets ={}
            for(let i in fields){
              _facets[fields[i]] = SOLR_FACETS[fields[i]];
            }
            return JSON.stringify(_facets);
          }
        }
      }),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: ['string', 'entity', 'newspaper'],
          required: true,
        },
        q: {
          required: false,
          min_length: 2,
          max_length: 500
        },
        uids: {
          regex: REGEX_UIDS,
          required: false,
          // we cannot transform since Mustache is rendering the filters...
          // transform: d => d.split(',')
        },
        uid: {
          regex: REGEX_UID,
          required: false,
          // we cannot transform since Mustache is rendering the filters...
          // transform: d => d.split(',')
        },
      },{
        required: false
      }),
      filtersToSolrQuery(),
      queryWithCommonParams(),

    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [
      proxyIIIF(),
      displayQueryParams(['toSq', 'filters']),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
