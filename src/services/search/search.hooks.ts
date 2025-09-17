import { SolrMappings } from '../../data/constants'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { REGEX_UID, utils, validate, validateEach } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'
import { SolrNamespaces } from '../../solr'
import { eachFilterValidator } from './search.validators'

export default {
  around: {
    create: [authenticate()],
  },
  before: {
    create: [
      validate(
        {
          collection_uid: {
            required: true,
            regex: REGEX_UID,
          },
          group_by: {
            required: true,
            choices: ['articles'],
            transform: (d: any) => utils.translate(d, SolrMappings.search.groupBy),
          },
          taskname: {
            required: false,
            choices: ['add_to_collection_from_query', 'add_to_collection_from_tr_passages_query'],
            defaultValue: 'add_to_collection_from_query',
          },
          index: {
            required: false,
            choices: [SolrNamespaces.Search, SolrNamespaces.TextReusePassages],
            defaultValue: SolrNamespaces.Search,
          },
        },
        'POST'
      ),
      validateEach('filters', eachFilterValidator, {
        required: true,
        method: 'POST',
      }),
      filtersToSolrQuery({
        prop: 'data' as any,
        overrideOrderBy: false,
        solrIndexProvider: (context: any) => context.data.index || SolrNamespaces.Search,
      }),
    ],
    update: [],
    patch: [],
    remove: [],
  },
}
