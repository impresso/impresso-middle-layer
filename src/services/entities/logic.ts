import { Filter } from 'impresso-jscommons'
import { SolrNamespaces } from '../../solr'
import { filtersToQueryAndVariables } from '../../util/solr'
import { SelectRequestBody } from '../../internalServices/simpleSolr'
import { TypeToTypeShorthand } from '../../utils/entity.utils'

const SolrFields = Object.freeze({
  Id: 'id',
  Label: 'l_s',
  Type: 't_s',
  AritcleFrequency: 'article_fq_f',
  MentionFrequency: 'mention_fq_f',
})

/**
 * Entity type tag changed in Solr with the new schema.
 * This method keeps the publicly visible tags (person, location, etc.)
 * in sync with the Solr schema version (pers, loc, etc.) by
 * updating the value from the public type from internal type
 */
const rewriteTypes = (filter: Filter) => {
  if (filter.type !== 'type') return filter

  const type = filter.q
  let newType = type

  if (typeof type === 'string') {
    newType = TypeToTypeShorthand[type] ?? type
  } else if (Array.isArray(type)) {
    newType = type.map(t => TypeToTypeShorthand[t] ?? t)
  }
  return { ...filter, q: newType }
}

interface BuildQueryParameters {
  filters: Filter[]
  orderBy?: string
  limit?: number
  offset?: number
}

export function buildSearchEntitiesSolrQuery({ filters, orderBy, limit, offset }: BuildQueryParameters) {
  const queryBase = filtersToQueryAndVariables(filters.map(rewriteTypes), SolrNamespaces.Entities)
  const request: SelectRequestBody = {
    ...queryBase,
    params: {
      hl: true,
      fl: [
        SolrFields.Id,
        SolrFields.Label,
        SolrFields.Type,
        SolrFields.AritcleFrequency,
        SolrFields.MentionFrequency,
      ].join(', '),
    },
  }

  if (orderBy) request.sort = orderBy
  if (limit != null) request.limit = limit
  if (offset != null) request.offset = offset

  return request
}
