const {
  utils, validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { assignIIIF } = require('../../hooks/iiif');

module.exports = {
  before: {
    all: [

    ],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        order_by: {
          before: (d) => {
            if (typeof d === 'string') {
              return d.split(',');
            }
            return d;
          },
          choices: ['name', '-name', 'date', '-date', 'relevance', '-relevance'],
          defaultValue: 'name',
          transform: d => utils.translate(d, {
            name: 'meta_issue_id_s ASC',
            '-name': 'meta_issue_id_s DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
            relevance: 'score ASC',
            '-relevance': 'score DESC',
          }),
          after: (d) => {
            if (Array.isArray(d)) {
              return d.join(',');
            }
            return d;
          },
        },
      }),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: ['newspaper'],
          required: true,
        },
        q: {
          required: false,
          min_length: 2,
          max_length: 500,
        },
      }, {
        required: false,
      }),
      filtersToSolrQuery('newspaper'),
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

      assignIIIF('cover'),
    ],
    get: [
      // change count_pages
      assignIIIF('pages'),
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
