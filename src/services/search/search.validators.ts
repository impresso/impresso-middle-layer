import { utils, REGEX_UID, REGEX_UIDS, ValidationRules } from '../../hooks/params'
import { SolrMappings, FilterTypes, Contexts, Operators, Precision } from '../../data/constants.js'
import { Filter } from 'impresso-jscommons'

const eachFilterValidator: ValidationRules<Filter & { daterange: string; uid: string }> = {
  context: {
    choices: Contexts,
    defaultValue: 'include',
  },
  op: {
    choices: Operators,
    defaultValue: 'OR',
  },
  type: {
    choices: FilterTypes,
    required: true,
  },
  precision: {
    choices: Precision,
    defaultValue: 'exact',
  },
  q: {
    required: false,
    min_length: 1,
    max_length: 6000,
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
}

const eachFacetFilterValidator = {
  name: {
    choices: Object.keys(SolrMappings.search.facets),
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
}

const paramsValidator = {
  q: {
    required: false,
    min_length: 2,
    max_length: 1000,
  },
  group_by: {
    required: true,
    choices: ['articles', 'raw'],
    defaultValue: 'articles',
    transform: (d: string) => utils.translate(d, SolrMappings.search.groupBy),
  },
  order_by: {
    before: (d: string) => {
      if (typeof d === 'string') {
        return d.split(',')
      }
      return d
    },
    choices: ['-date', 'date', '-relevance', 'relevance', 'id', '-id'],
    transform: (d: string) => utils.toOrderBy(d, SolrMappings.search.orderBy, true),
    after: (d: string | string[]) => {
      if (Array.isArray(d)) {
        return d.join(',')
      }
      return d
    },
  },
}

export { eachFilterValidator, eachFacetFilterValidator, paramsValidator }
