// @ts-check
const { uniq, values, groupBy } = require('lodash');
const { SolrNamespaces } = require('../../solr');
const { sameTypeFiltersToQuery } = require('../../util/solr');


const SolrFields = Object.freeze({
  Id: 'id',
  Label: 'l_s',
  Type: 't_s',
  AritcleFrequency: 'article_fq_f',
  MentionFrequency: 'mention_fq_f',
});

/**
 * @typedef {import('../../models').Filter} Filter
 */

function filtersToSolrQuery(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'));
  return uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.Entities)))
    .join(' AND ');
}


/**
 * @param {{
 *  filters: Filter[],
 *  orderBy?: string,
 *  limit?: number,
 *  skip?: number
 * }} parameters
 *
 * @return {any}
 */
function buildSearchEntitiesSolrQuery({
  filters, orderBy, limit, skip,
}) {
  const request = {
    query: filters.length > 0 ? filtersToSolrQuery(filters) : '*:*',
    params: {
      hl: true,
      fl: [
        SolrFields.Id,
        SolrFields.Label,
        SolrFields.Type,
        SolrFields.AritcleFrequency,
        SolrFields.MentionFrequency,
      ],
    },
  };

  if (orderBy) request.sort = orderBy;
  if (limit != null) request.limit = limit;
  if (skip != null) request.offset = skip;

  return request;
}

module.exports = {
  buildSearchEntitiesSolrQuery,
};
