import type { Params } from '@feathersjs/feathers'
import type { ImpressoApplication } from '@/types.js'
import type {
  ClusterElement,
  Facet,
  FindTextReuseClustersResponse,
  GetTextReuseClusterResponse,
} from '@/services/text-reuse-clusters/models/generated.js'
import { FindQueyParameters } from '@/services/text-reuse-clusters/text-reuse-clusters.schema.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { getToSelect } from '@/util/solr/adapters.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import { OpenPermissions } from '@/util/bigint.js'
import { filtersToQueryAndVariables } from '@/util/solr/index.js'
import { Filter } from '@/models/index.js'

import { mapValues, groupBy, clone, get } from 'lodash-es'
import { NotFound } from '@feathersjs/errors'
import { protobuf } from 'impresso-jscommons'
import {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsTextAndPermissionsFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getPaginationInfoFromPassagesSolrResponse,
  getLatestTextReusePassageForClusterIdRequest,
  PassageFields,
  buildSolrRequestForExtraClusterDetails,
  getFacetsFromExtraClusterDetailsResponse,
  getTimelineResolution,
  buildConnectedClustersCountRequest,
  parseConnectedClustersCountResponse,
} from '@/logic/textReuse/solr.js'
import { parseOrderBy } from '@/util/queryParameters.js'
import { SolrNamespaces } from '@/solr.js'

interface ClusterIdAndTextAndPermission {
  id: any
  text: any
  permissionBitmapExplore?: number
  permissionsBitmapGetTranscript?: number
}

function buildResponseClusters(
  clusters: any,
  clusterIdsAndTextAndPermissions: ClusterIdAndTextAndPermission[]
): ClusterElement[] {
  const clustersById = mapValues(groupBy(clusters, 'id'), (v: any[]) => v[0])
  const results = clusterIdsAndTextAndPermissions.map(
    ({ id, text: textSample, permissionBitmapExplore, permissionsBitmapGetTranscript }) => ({
      cluster: clustersById[id],
      textSample,
      bitmapExplore: BigInt(permissionBitmapExplore ?? OpenPermissions),
      bitmapGetTranscript: BigInt(permissionsBitmapGetTranscript ?? OpenPermissions),
    })
  )
  return results
}

const deserializeFilters = (serializedFilters: string) => protobuf.searchQuery.deserialize(serializedFilters).filters

export const OrderByKeyToField = {
  'passages-count': PassageFields.ClusterSize,
}

const withExtraQueryParts = (query: { q: any }, parts: any) => {
  const updatedQuery = clone(query)
  updatedQuery.q = [`(${query.q})`].concat(parts).join(' AND ')
  return updatedQuery
}

async function facetsWithItems(facets: Facet[], mediaSourcesService: MediaSources) {
  const newspapersLookup = await mediaSourcesService.getLookup()

  return Promise.all(
    facets.map(async facet => {
      if (facet.type === 'newspaper') {
        return {
          ...facet,
          buckets: await Promise.all(
            facet.buckets?.map(async bucket => ({
              ...bucket,
              item: newspapersLookup[bucket.val],
            })) ?? []
          ),
        }
      }
      return facet
    })
  )
}

/**
 * Text Reuse Passages index does not have a "country" field. But we can get country
 * from newspaper bucket items and recreate buckets for a virtual "country" facet.
 */
function facetsWithCountry(facets: Facet[]) {
  const newspaperFacet = facets.find(({ type }) => type === 'newspaper')
  if (newspaperFacet == null) return facets

  const countsByCountry: Record<string, number> | undefined = newspaperFacet.buckets?.reduce(
    (counts: Record<string, number>, bucket: any) => {
      const countryCodeProperty = get(bucket, 'item.properties', []).find(
        ({ name }: { name: string }) => name === 'countryCode'
      )
      if (countryCodeProperty != null) {
        const countryCount = get(counts, countryCodeProperty.value, 0)
        counts[countryCodeProperty.value] = countryCount + bucket.count
      }
      return counts
    },
    {}
  )

  const countriesBuckets = Object.entries(countsByCountry ?? {}).map(([countryCode, count]) => ({
    val: countryCode,
    count,
  }))

  return facets.concat([
    {
      type: 'country',
      numBuckets: countriesBuckets.length,
      buckets: countriesBuckets,
    },
  ])
}

export class TextReuseClusters {
  solr: SimpleSolrClient
  app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.app = app
  }

  private get mediaSourcesService() {
    return this.app.service('media-sources')
  }

  async find(params: Params<FindQueyParameters>): Promise<FindTextReuseClustersResponse> {
    const { text, offset = 0, limit = 10, order_by: orderBy } = params.query ?? {}
    const { filters }: Pick<FindQueyParameters, 'filters'> = (params as any).sanitized ?? {}
    const { query: extraQuery, filter: filterQueryParts } = filtersToQueryAndVariables(
      filters as Filter[],
      SolrNamespaces.TextReusePassages,
      this.app.get('solrConfiguration').namespaces ?? []
    )
    const [orderByField, orderByDescending] = parseOrderBy(orderBy as string, OrderByKeyToField)
    const query = getTextReusePassagesClusterIdsSearchRequestForText(
      text as string,
      offset,
      limit,
      orderByField,
      orderByDescending
    )

    const fullQuery = (extraQuery as string).length > 0 ? `(${query.q}) AND (${extraQuery})` : query.q

    const [clusterIdsAndTextAndPermissions, info] = await this.solr
      .select(SolrNamespaces.TextReusePassages, {
        body: {
          query: fullQuery,
          filter: filterQueryParts as string[],
          limit: query.rows,
          offset: query.start,
          sort: query.sort,
          fields: query.fl,
          params: {
            hl: query.hl ?? false,
          },
        },
      })
      .then(response => [
        getClusterIdsTextAndPermissionsFromPassagesSolrResponse(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ])

    const clusters = await this.getClusters(clusterIdsAndTextAndPermissions.map(({ id }: { id: string }) => id))

    return {
      clusters: buildResponseClusters(clusters, clusterIdsAndTextAndPermissions),
      info,
      total: info.total,
      limit: info.limit,
      offset: info.offset,
    }
  }

  async getClusters(ids: string[]) {
    if (ids.length < 1) return []
    return await this.solr
      .select(this.solr.namespaces.TextReuseClusters, getToSelect(getTextReuseClustersRequestForIds(ids)))
      .then(convertClustersSolrResponseToClusters)
  }

  async get(id: string, { query = {} }): Promise<GetTextReuseClusterResponse> {
    // @ts-ignore
    const includeDetails = query.include_details === true || query.include_details === 'true'

    const sampleTextPromise = this.solr
      .select(this.solr.namespaces.TextReusePassages, getToSelect(getLatestTextReusePassageForClusterIdRequest(id)))
      .then(getClusterIdsTextAndPermissionsFromPassagesSolrResponse)

    const clusterPromise = this.solr
      .select(this.solr.namespaces.TextReuseClusters, getToSelect(getTextReuseClustersRequestForIds([id])))
      .then(convertClustersSolrResponseToClusters)

    const connectedClustersCountPromise = this.solr
      .select(this.solr.namespaces.TextReusePassages, getToSelect(buildConnectedClustersCountRequest(id) as any))
      .then(parseConnectedClustersCountResponse)

    const [clusterIdsAndTextAndPermissions, clusters, connectedClustersCount] = await Promise.all([
      sampleTextPromise,
      clusterPromise,
      connectedClustersCountPromise,
    ])

    const clusterItems = buildResponseClusters(
      clusters,
      clusterIdsAndTextAndPermissions as any as ClusterIdAndTextAndPermission[]
    )

    if (clusterItems.length < 1) throw new NotFound()
    const cluster = clusterItems[0]
    if (cluster?.cluster != null) cluster.cluster.connectedClustersCount = connectedClustersCount as any as number

    if (!includeDetails) return cluster

    // fetch cluster extra details

    const extraClusterDetailsRequest = buildSolrRequestForExtraClusterDetails(id, cluster.cluster?.timeCoverage as any)

    const extraClusterDetailsResponse = await this.solr.select(this.solr.namespaces.TextReusePassages, {
      body: extraClusterDetailsRequest as any,
    })
    const facets = getFacetsFromExtraClusterDetailsResponse(extraClusterDetailsResponse)

    cluster.details = { facets: await facetsWithItems(facets, this.mediaSourcesService) }

    cluster.details.facets = facetsWithCountry(cluster.details.facets)
    cluster.details.resolution = getTimelineResolution(
      cluster.cluster.timeCoverage?.from as any,
      cluster.cluster.timeCoverage?.to as any
    ) as any

    return cluster
  }
}
