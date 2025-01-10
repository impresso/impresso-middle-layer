import { SolrFacetQueryParams } from '../data/types'
import { SimpleSolrClient, SelectRequestBody, Bucket } from '../internalServices/simpleSolr'
import { SolrNamespaces } from '../solr'
import { bigIntToBitString, bigIntToLongString } from '../util/bigint'

export type PermissionsScope = 'explore' | 'get_transcript' | 'get_images'
const permissionsScopes: PermissionsScope[] = ['explore', 'get_transcript', 'get_images']

type BitmapFacetField = 'rights_bm_explore_l' | 'rights_bm_get_tr_l' | 'rights_bm_get_img_l'
const bitmapFacetFields: BitmapFacetField[] = ['rights_bm_explore_l', 'rights_bm_get_tr_l', 'rights_bm_get_img_l']

export interface PermissionDetails {
  bitmap: BigInt // this may not be displayed correctly in the browser because it may be out of safe integer range
  bitmapString: string
  bitmapStringBin: string
  totalItems: number
  sample: {
    id: string
    articleUrl?: string
    rights_perm_use_explore_plain?: string
    rights_perm_use_get_tr_plain?: string
    rights_perm_use_get_img_plain?: string
  }
}

interface ScopedPermissions<P = PermissionDetails> {
  scope: PermissionsScope
  permissions: P[]
}

export interface ContentItemPermissionsDetails {
  permissions: ScopedPermissions[]
}

const FieldToScope: Record<BitmapFacetField, PermissionsScope> = {
  rights_bm_explore_l: 'explore',
  rights_bm_get_tr_l: 'get_transcript',
  rights_bm_get_img_l: 'get_images',
}

const ScopeToField = Object.entries(FieldToScope).reduce(
  (acc, [field, scope]) => {
    acc[scope] = field as BitmapFacetField
    return acc
  },
  {} as Record<PermissionsScope, BitmapFacetField>
)

/**
 * A query that returns all possible values for the bitmap fields that represent permissions.
 */
const getBitmapsFacets: SelectRequestBody = {
  query: '*:*',
  limit: 0,
  offset: 0,
  params: { hl: false },
  facet: bitmapFacetFields.reduce(
    (acc, field) => {
      acc[field] = {
        type: 'terms',
        field,
        mincount: 1,
        limit: 1000000,
      }
      return acc
    },
    {} as Record<string, SolrFacetQueryParams>
  ),
}

const getSample = (field: BitmapFacetField, permission: BigInt): SelectRequestBody => ({
  query: '*:*',
  filter: `filter(${field}:${permission.toString()})`,
  fields: ['id', 'rights_perm_use_explore_plain', 'rights_perm_use_get_tr_plain', 'rights_perm_use_get_img_plain'].join(
    ','
  ),
  limit: 1,
  offset: 0,
  params: {
    hl: false,
  },
})

interface SampleSolrDocument {
  id: string
  rights_perm_use_explore_plain?: string
  rights_perm_use_get_tr_plain?: string
  rights_perm_use_get_img_plain?: string
}

export const getContentItemsPermissionsDetails = async (
  solrClient: SimpleSolrClient
): Promise<ContentItemPermissionsDetails> => {
  const response = await solrClient.select<unknown, BitmapFacetField, Bucket>(SolrNamespaces.Search, {
    body: getBitmapsFacets,
  })

  const permissionsItems = bitmapFacetFields.map(
    field =>
      ({
        scope: FieldToScope[field],
        permissions: toPermissionDetails(response.facets?.[field]?.buckets ?? []),
      }) satisfies ScopedPermissions<Omit<PermissionDetails, 'sample'>>
  )

  const permissionsItemsWithSample = await Promise.all(
    permissionsItems.map(
      async ({ scope, permissions }) =>
        ({
          scope,
          permissions: await Promise.all(permissions.map(withSample(scope, solrClient))),
        }) satisfies ScopedPermissions
    )
  )

  return { permissions: permissionsItemsWithSample }
}

const toPermissionDetails = (buckets: Bucket[]): Omit<PermissionDetails, 'sample'>[] => {
  return buckets.map(bucket => {
    // Value can be either a number (if it fits) or a bigint (if it doesn't)
    const bitmap = typeof bucket.val === 'bigint' ? bucket.val! : BigInt(bucket.val! as number)

    return {
      bitmap,
      bitmapString: bigIntToLongString(bitmap),
      bitmapStringBin: bigIntToBitString(bitmap),
      totalItems: bucket.count ?? 0,
    }
  })
}

const withSample =
  (scope: PermissionsScope, solrClient: SimpleSolrClient) =>
  async (details: Omit<PermissionDetails, 'sample'>): Promise<PermissionDetails> => {
    const response = await solrClient.select<SampleSolrDocument, never, never>(SolrNamespaces.Search, {
      body: getSample(ScopeToField[scope], details.bitmap),
    })

    const doc = response.response?.docs?.[0]
    if (doc === undefined) throw new Error('No sample document found')

    return {
      ...details,
      sample: {
        ...doc,
      },
    }
  }
