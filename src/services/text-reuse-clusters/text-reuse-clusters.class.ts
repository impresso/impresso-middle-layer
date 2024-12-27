import type { Params } from '@feathersjs/feathers'
import { CachedSolrClient } from '../../cachedSolr'
import type { ImpressoApplication } from '../../types'
import type {
  ClusterElement,
  Facet,
  FindTextReuseClustersResponse,
  GetTextReuseClusterResponse,
} from './models/generated'
import { FindQueyParameters } from './text-reuse-clusters.schema'
import { NewspapersService } from '../newspapers/newspapers.class'

const { mapValues, groupBy, values, uniq, clone, get } = require('lodash')
const { NotFound } = require('@feathersjs/errors')
const { protobuf } = require('impresso-jscommons')
const {
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
} = require('../../logic/textReuse/solr')
const { parseOrderBy } = require('../../util/queryParameters')
const { sameTypeFiltersToQuery } = require('../../util/solr')
const { SolrNamespaces } = require('../../solr')
const Newspaper = require('../../models/newspapers.model')

function buildResponseClusters(
  clusters: any,
  clusterIdsAndTextAndPermissions: {
    id: any
    text: any
    permissionBitmapExplore?: number
    permissionsBitmapGetTranscript?: number
  }[]
): ClusterElement[] {
  const clustersById = mapValues(groupBy(clusters, 'id'), (v: any[]) => v[0])
  const results = clusterIdsAndTextAndPermissions.map(
    ({ id, text: textSample, permissionBitmapExplore, permissionsBitmapGetTranscript }) => ({
      cluster: clustersById[id],
      textSample,
      bitmapExplore: BigInt(permissionBitmapExplore ?? Number.MAX_SAFE_INTEGER),
      bitmapGetTranscript: BigInt(permissionsBitmapGetTranscript ?? Number.MAX_SAFE_INTEGER),
    })
  )
  return results
}

const deserializeFilters = (serializedFilters: string) => protobuf.searchQuery.deserialize(serializedFilters).filters

function filtersToSolrQueries(filters: any, namespace = SolrNamespaces.TextReusePassages) {
  const filtersGroupsByType = values(groupBy(filters, 'type'))
  return uniq(filtersGroupsByType.map((f: any) => sameTypeFiltersToQuery(f, namespace)))
}

export const OrderByKeyToField = {
  'passages-count': PassageFields.ClusterSize,
}

const withExtraQueryParts = (query: { q: any }, parts: any) => {
  const updatedQuery = clone(query)
  updatedQuery.q = [`(${query.q})`].concat(parts).join(' AND ')
  return updatedQuery
}

async function facetsWithItems(facets: Facet[], newspapersService: NewspapersService) {
  const newspapersLookup = await newspapersService.getLookup()

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
  solr: CachedSolrClient
  app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.solr = app.service('cachedSolr')
    this.app = app
  }

  private get newspapersService() {
    return this.app.service('newspapers')
  }

  async find(params: Params<FindQueyParameters>): Promise<FindTextReuseClustersResponse> {
    const { text, offset = 0, limit = 10, order_by: orderBy } = params.query ?? {}
    const { filters }: Pick<FindQueyParameters, 'filters'> = (params as any).sanitized ?? {}
    const filterQueryParts = filtersToSolrQueries(filters, SolrNamespaces.TextReusePassages)
    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField)
    const query = getTextReusePassagesClusterIdsSearchRequestForText(
      text,
      offset,
      limit,
      orderByField,
      orderByDescending
    )

    const [clusterIdsAndTextAndPermissions, info] = await this.solr
      .get(withExtraQueryParts(query, filterQueryParts), this.solr.namespaces.TextReusePassages)
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
      .get(getTextReuseClustersRequestForIds(ids), this.solr.namespaces.TextReuseClusters)
      .then(convertClustersSolrResponseToClusters)
  }

  async get(id: string, { query = {} }): Promise<GetTextReuseClusterResponse> {
    // @ts-ignore
    const includeDetails = query.include_details === true || query.include_details === 'true'

    const sampleTextPromise = this.solr
      .get(getLatestTextReusePassageForClusterIdRequest(id), this.solr.namespaces.TextReusePassages)
      .then(getClusterIdsTextAndPermissionsFromPassagesSolrResponse)

    const clusterPromise = this.solr
      .get(getTextReuseClustersRequestForIds([id]), this.solr.namespaces.TextReuseClusters)
      .then(convertClustersSolrResponseToClusters)

    const connectedClustersCountPromise = this.solr
      .post(buildConnectedClustersCountRequest(id), this.solr.namespaces.TextReusePassages)
      .then(parseConnectedClustersCountResponse)

    const [clusterIdsAndTextAndPermissions, clusters, connectedClustersCount] = await Promise.all([
      sampleTextPromise,
      clusterPromise,
      connectedClustersCountPromise,
    ])

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndTextAndPermissions)

    if (clusterItems.length < 1) throw new NotFound()
    const cluster = clusterItems[0]
    cluster.cluster.connectedClustersCount = connectedClustersCount

    if (!includeDetails) return cluster

    // fetch cluster extra details

    const extraClusterDetailsRequest = buildSolrRequestForExtraClusterDetails(id, cluster.cluster.timeCoverage)

    const extraClusterDetailsResponse = await this.solr.post(
      extraClusterDetailsRequest,
      this.solr.namespaces.TextReusePassages
    )
    const facets = getFacetsFromExtraClusterDetailsResponse(extraClusterDetailsResponse)

    cluster.details = { facets: await facetsWithItems(facets, this.newspapersService) }

    cluster.details.facets = facetsWithCountry(cluster.details.facets)
    cluster.details.resolution = getTimelineResolution(
      cluster.cluster.timeCoverage?.from,
      cluster.cluster.timeCoverage?.to
    )

    return cluster
  }
}
