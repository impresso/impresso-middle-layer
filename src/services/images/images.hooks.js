// const { authenticate } = require('@feathersjs/authentication').hooks;
const { assignIIIF } = require('../../hooks/iiif');
const {
  utils, validate, validateEach, queryWithCommonParams, displayQueryParams,
} = require('../../hooks/params');
const {
  qToSolrFilter, filtersToSolrQuery,
} = require('../../hooks/search');

const Newspaper = require('../../models/newspapers.model');
const Topic = require('../../models/topics.model');

const resolveFacets = () => async(context) => {
  if(context.result && context.result.info && context.result.info.facets) {
    // enrich facets
    if(context.result.info.facets.newspaper) {
      context.result.info.facets.newspaper.buckets = context.result.info.facets.newspaper.buckets.map(d => ({
        ...d,
        item: Newspaper.getCached(d.val),
        uid: d.val,
      }));
    }
  }
  console.log('resolveFacets', context.result.info.facets.newspaper);

}

const resolveQueryComponents = () => async (context) => {
  for(let i = 0, l=context.params.sanitized.queryComponents.length; i < l; i += 1) {
    const d = {
      ...context.params.sanitized.queryComponents[i],
    };
    if (d.type === 'newspaper') {
      if (!Array.isArray(d.q)) {
        d.item = Newspaper.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Newspaper.getCached(uid));
      }
    } else if (d.type === 'topic') {
      if (!Array.isArray(d.q)) {
        d.item = Topic.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Topic.getCached(uid));
      }
    }
    context.params.sanitized.queryComponents[i] = d;
  }
};

const filtersValidator = {
  context: {
    choices: ['include', 'exclude'],
    defaultValue: 'include',
  },
  type: {
    choices: ['issue', 'newspaper', 'year', 'type', 'daterange', 'isFront'],
    required: true,
  },
  q: {
    required: false,
    min_length: 2,
    max_length: 500,
  },
  // compatible only with type daterange, unused elsewhere.
  // If it is an array, an OR will be used to JOIN the array items..
  // ex: ['* TO 1950-12-01', '1960-01-01 TO 1940-12-01']
  // q= ... AND (date_e:[* TO 1950-12-01] OR date_s:[1960-01-01 TO 1940-12-01])
  daterange: {
    regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) TO (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/,
    required: false,
  },
};

module.exports = {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
      validate({
        order_by: utils.orderBy({
          values: {
            relevance: 'score ASC',
            '-relevance': 'score DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
          },
          defaultValue: 'date',
        }),
        facets: utils.facets({
          values: {
            year: {
              type: 'terms',
              field: 'meta_year_i',
              mincount: 1,
              limit: 400,
            },
            newspaper: {
              type: 'terms',
              field: 'meta_journal_s',
              mincount: 1,
              limit: 20,
              numBuckets: true,
            },
            date: {
              type: 'terms',
              field: 'meta_date_dt',
              mincount: 1,
              limit: 100,
            },
          },
        }),
      }),
      validateEach('filters', filtersValidator, {
        required: false,
      }),
      qToSolrFilter('string'),
      filtersToSolrQuery(['newspaper', 'year', 'type', 'daterange', 'isFront']),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      assignIIIF('pages', 'regions'),
      resolveFacets(),
      displayQueryParams(['queryComponents', 'filters']),
      resolveQueryComponents(),
    ],
    get: [
      assignIIIF('pages', 'regions'),
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
