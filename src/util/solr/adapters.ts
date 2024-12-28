import { SolrFacetQueryParams } from '../../data/types'
import { BucketValue, ResponseContainer, SelectRequestBody, SelectResponse } from '../../internalServices/simpleSolr'

interface FindAllParams {
  q?: string
  limit?: number
  offset?: number
  fq?: string
  highlight_by?: string
  highlightProps?: Record<string, string>
  vars?: Record<string, string>
  order_by?: string
  facets?: Record<string, SolrFacetQueryParams>
  group_by?: string
  collapse_by?: string
  collapse_fn?: string
  expand?: boolean
  fl?: string | string[]
  form?: {
    q: string
  }
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

  const request: SelectRequestBody = {
    query: params.form?.q ?? params?.q ?? '*:*',
    facet: params.facets,
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
    filter: params.fq,
    sort: params.order_by,
    fields: collapse ?? fields,
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

export const findAllResponseAdapter = <T, K extends string, B extends BucketValue, O>(
  result: SelectResponse<T, K, B>,
  factory: (doc: T) => O
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

  if (response != null) {
    const { docs, ...rest } = response
    updatedResponse = {
      ...rest,
      docs: docs?.map(factory) ?? [],
    }
  }
  return {
    ...rest,
    response: updatedResponse,
  }
}
