import { SolrNamespace } from '../../solr'
import { SolrFacetQueryParams } from '../../data/types'
import {
  BucketValue,
  FacetsContainer,
  ResponseContainer,
  SelectRequest,
  SelectRequestBody,
  SelectResponse,
  SimpleSolrClient,
} from '../../internalServices/simpleSolr'
import { findByIds } from '../../solr/queryBuilders'

export type SolrFactory<T, K extends string, B extends BucketValue, O> = (
  response: SelectResponse<T, K, B>
) => (doc: T) => O

export interface SolrGetRequestQueryParams {
  q: string
  hl?: boolean
  start?: number
  rows?: number
  sort?: string
  fl?: string
  fq?: string
}

interface FindAllParams {
  q?: string
  limit?: number
  offset?: number
  fq?: string | string[]
  highlight_by?: string
  highlightProps?: Record<string, string>
  vars?: Record<string, string>
  order_by?: string
  facets?: Record<string, SolrFacetQueryParams> | string
  group_by?: string
  collapse_by?: string
  collapse_fn?: string
  expand?: boolean
  fl?: string | string[]
  form?: {
    q: string
  }
}

export const getToSelect = (getRequest: SolrGetRequestQueryParams): SelectRequest => {
  const body: SelectRequestBody = {
    query: getRequest.q,
    offset: getRequest.start,
    limit: getRequest.rows,
    fields: getRequest.fl,
    filter: getRequest.fq,
    sort: getRequest.sort,
    params: {
      hl: getRequest.hl ?? false,
    },
  }
  return { body }
}

/**
 * Adapter for legacy `findAll` from `solrt.ts` to use in `simpleSolr.ts`.
 */
export const findAllRequestAdapter = (params: FindAllParams): SelectRequestBody => {
  const highlight =
    params.highlight_by != null
      ? {
          'hl.fl': params.highlight_by,
          ...(params.highlightProps ?? {}),
        }
      : {}

  const group: Record<string, string | number | boolean> =
    params.group_by != null && params.group_by !== 'id'
      ? { 'group.field': params.group_by, group: true, 'group.limit': 3, 'group.ngroups': true }
      : {}

  const collapse =
    Object.keys(group).length == 0 && params.collapse_by != null
      ? `{!collapse field=${params.collapse_by} ${params.collapse_fn ?? ''}}`
      : undefined

  const fields = Array.isArray(params.fl) ? params.fl.join(',') : params.fl

  let filter = undefined
  if (collapse != null && params.fq != null) {
    filter = `${collapse} AND ${params.fq}`
  } else if (collapse != null) {
    filter = collapse
  } else if (params.fq != null) {
    filter = params.fq
  }

  const request: SelectRequestBody = {
    query: params.form?.q ?? params?.q ?? '*:*',
    facet: typeof params.facets === 'string' ? JSON.parse(params.facets) : params.facets,
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
    filter: filter,
    sort: params.order_by,
    fields: fields,
    params: {
      ...(params.highlightProps ?? {}),
      ...(params.vars ?? {}),
      ...highlight,
      ...group,
      ...(params.expand && params.collapse_by != null ? { expand: true } : {}),
    },
  }
  return request
}

/**
 * Adapter for legacy `findAll` from `solrt.ts` to use in `simpleSolr.ts`.
 */
export const findAllResponseAdapter = <T, K extends string, B extends BucketValue, O>(
  result: SelectResponse<T, K, B>,
  factory?: (response: SelectResponse<T, K, B>) => (doc: T) => O
): SelectResponse<O, K, B> => {
  const { response, ...rest } = result

  let updatedResponse: ResponseContainer<O> | undefined = undefined

  if (result.grouped != null) {
    const groupKey = Object.keys(result.grouped)[0]

    updatedResponse = {
      numFound: (result.grouped[groupKey]?.ngroups as number) ?? 0,
      docs: result.grouped[groupKey]?.groups,
      start: 0,
    }
  }

  const actualFactory = factory != null ? factory(result) : (doc: T) => doc as unknown as O

  if (response != null) {
    const { docs, ...rest } = response
    updatedResponse = {
      ...rest,
      docs: docs?.map(actualFactory) ?? [],
    }
  }
  return {
    ...rest,
    response: updatedResponse,
  }
}

/**
 * A function that combines the two above.
 */
export const asFindAll = async <T, K extends string, B extends BucketValue, O>(
  solr: SimpleSolrClient,
  namespace: SolrNamespace,
  params: FindAllParams,
  factory?: (response: SelectResponse<T, K, B>) => (doc: T) => O
): Promise<SelectResponse<O, K, B>> => {
  const request = findAllRequestAdapter(params)
  const response = await solr.select<T, K, B>(namespace, { body: request })
  return findAllResponseAdapter<T, K, B, O>(response, factory)
}

interface FindParams {
  q?: string
  fq?: string
  query?: {
    sq?: string
    sfq?: string | string[]
    facets?: Record<string, SolrFacetQueryParams>
    order_by?: string
    highlight_by?: string
    limit?: number
    offset?: number
  }
  fl?: string | string[]
  collapse_by?: string
  collapse_fn?: string
}

export const findRequestAdapter = (params: FindParams): SelectRequestBody => {
  const p: FindAllParams = {
    q: params.q ?? params.query?.sq ?? '*:*',
    fq: params.fq || params.query?.sfq || undefined,
    limit: params.query?.limit,
    offset: params.query?.offset,
    fl: params.fl,
    facets: params.query?.facets,
    order_by: params.query?.order_by, // default ordering TODO
    highlight_by: params.query?.highlight_by,
    collapse_by: params.collapse_by,
    collapse_fn: params.collapse_fn,
  }
  // removing unnecessary indefined fields.
  Object.keys(p).forEach(key => (p as any)[key] === undefined && delete (p as any)[key])
  return findAllRequestAdapter(p)
}

interface FindResponse<O, K extends string, B extends BucketValue> {
  data: O[]
  total: number
  limit?: number
  offset?: number
  info: {
    responseTime: {
      solr?: number
    }
    facets?: FacetsContainer<K, B>
  }
}

export const findResponseAdapter = <T, K extends string, B extends BucketValue, O>(
  result: SelectResponse<T, K, B>,
  limit?: number,
  offset?: number,
  factory?: (response: SelectResponse<T, K, B>) => (doc: T) => O
): FindResponse<O, K, B> => {
  const results = findAllResponseAdapter(result, factory)
  return {
    data: results?.response?.docs ?? [],
    total: results?.response?.numFound ?? 0,
    limit: limit,
    offset: offset,
    info: {
      responseTime: {
        solr: results?.responseHeaders?.QTime,
      },
      facets: results.facets,
    },
  }
}

/**
 * A function that combines the two above.
 */
export const asFind = async <T, K extends string, B extends BucketValue, O>(
  solr: SimpleSolrClient,
  namespace: SolrNamespace,
  params: FindParams,
  factory?: (response: SelectResponse<T, K, B>) => (doc: T) => O
): Promise<FindResponse<O, K, B>> => {
  const request = findRequestAdapter(params)
  const response = await solr.select<T, K, B>(namespace, { body: request })
  return findResponseAdapter<T, K, B, O>(response, request.limit, request.offset, factory)
}

export const asGet = async <T, K extends string, B extends BucketValue, O>(
  solr: SimpleSolrClient,
  namespace: SolrNamespace,
  id: string,
  params: { fl: string | string[] },
  factory?: (response: SelectResponse<T, K, B>) => (doc: T) => O
): Promise<O | undefined> => {
  const selectRequest = findAllRequestAdapter({
    q: `id:${id}`,
    limit: 1,
    offset: 0,
    fl: params.fl,
  })
  const response = await solr.select<T, K, B>(namespace, { body: selectRequest })
  const results = findAllResponseAdapter(response, factory)
  return results.response?.docs?.[0]
}

interface ResolveAsyncGroup<T, K extends string, B extends BucketValue, O> {
  items: { [key: string]: string | O }[]
  namespace: SolrNamespace
  Klass: { SOLR_FL: string[]; solrFactory: SolrFactory<T, K, B, O> }
  idField: string
  itemField: string
  factory?: SolrFactory<T, K, B, O>
}

export const resolveAsync = async <T extends { id: string }, K extends string, B extends BucketValue, O>(
  solr: SimpleSolrClient,
  group: ResolveAsyncGroup<T, K, B, O>,
  factory?: SolrFactory<T, K, B, O>
) => {
  if (group.items.length == 0) return group

  const ids: string[] = group.items.map((d: any) => d[group.idField || 'uid'])
  const result = await solr.select<T, K, B>(group.namespace, findByIds(ids, group.Klass.SOLR_FL))
  const actualFactory = factory ?? group.factory ?? group.Klass?.solrFactory

  const resolvedItems = result.response?.docs?.map(doc => {
    const idx = ids.indexOf(doc.id)
    const item = group.items[idx]
    const itemKey = group.itemField ?? 'item'
    const itemFieldValue = actualFactory(result)(doc)

    item[itemKey] = itemFieldValue

    return { ...item, [itemKey]: itemFieldValue }
  })

  return { ...group, items: resolvedItems }
}
