const {
  utils, REGEX_UID, REGEX_UIDS,
} = require('../../hooks/params');
const {
  SOLR_ORDER_BY, SOLR_FACETS, SOLR_GROUP_BY,
} = require('../../hooks/search');

const eachFilterValidator = {
  context: {
    choices: ['include', 'exclude'],
    defaultValue: 'include',
  },
  op: {
    choices: ['AND', 'OR'],
    defaultValue: 'OR',
  },
  type: {
    choices: [
      'uid',
      'hasTextContents',
      'title',
      'isFront',
      'page',
      'issue',
      'title',
      'string', 'entity', 'newspaper', 'daterange',
      'year', 'language', 'type', 'regex',
      // mention allows to find both mentions of type person and location
      'mention', 'person', 'location',
      // today's special
      'topic',
      // filter by user collections! Only when authentified
      'collection',
      // numeric filters
      'ocrQuality',
      'contentLength',
      // country of article
      'country',
      // access right
      'accessRight',
      // meta_partnerid_s
      'partner',
    ],
    required: true,
  },
  precision: {
    choices: ['fuzzy', 'soft', 'exact', 'partial'],
    default: 'exact',
  },
  q: {
    required: false,
    min_length: 1,
    max_length: 500,
  },
  // langs: {
  //   before: (d) => {
  //     if (typeof d === 'string') {
  //       return d.split(',');
  //     }
  //     return d;
  //   },
  //   choices: ['fr','en','de'],
  //   defaultValue: 'fr,en,de',
  //   transform: d => (Array.isArray(d) ? d : d.split(',')),
  // },
  // compatible only with type daterange, unused elsewhere.
  // If it is an array, an OR will be used to JOIN the array items..
  // ex: ['* TO 1950-12-01', '1960-01-01 TO 1940-12-01']
  // q= ... AND (date_e:[* TO 1950-12-01] OR date_s:[1960-01-01 TO 1940-12-01])
  daterange: {
    regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) TO (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/,
    required: false,
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
};

const eachFacetFilterValidator = {
  name: {
    choices: Object.keys(SOLR_FACETS),
    required: true,
  },
  q: {
    required: false,
    min_length: 2,
    max_length: 10,
  },
  page: {
    required: false,
    regex: /\d+/,
  },
};

const paramsValidator = {
  q: {
    required: false,
    min_length: 2,
    max_length: 1000,
  },
  group_by: {
    required: true,
    choices: ['articles', 'raw'],
    transform: d => utils.translate(d, SOLR_GROUP_BY),
  },
  order_by: {
    before: (d) => {
      if (typeof d === 'string') {
        return d.split(',');
      }
      return d;
    },
    choices: ['-date', 'date', '-relevance', 'relevance', '-name', 'name', 'id', '-id'],
    transform: d => utils.toOrderBy(d, SOLR_ORDER_BY, true),
    after: (d) => {
      if (Array.isArray(d)) {
        return d.join(',');
      }
      return d;
    },
  },
};

const facetsValidator = {
  facets: utils.facets({
    values: SOLR_FACETS,
  }),
};

module.exports = {
  eachFilterValidator,
  eachFacetFilterValidator,
  paramsValidator,
  facetsValidator,
};
