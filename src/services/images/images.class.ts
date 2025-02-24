import { NotFound } from '@feathersjs/errors'
import { ClientService, Id, Params } from '@feathersjs/feathers'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import { Filter } from '../../models'
import { PublicFindResponse } from '../../models/common'
import { Image, MediaSource } from '../../models/generated/schemas'
import { Image as ImageDocument } from '../../models/generated/solr'
import { SolrNamespaces } from '../../solr'
import { sanitizeIiifImageUrl } from '../../util/iiif'
import { filtersToSolrQueries } from '../../util/solr'
import { MediaSources } from '../media-sources/media-sources.class'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '../../models/authorization'
import { ImageUrlRewriteRule } from '../../models/generated/common'

const DefaultLimit = 10
const ImageSimilarityVectorField: keyof ImageDocument = 'dinov2_emb_v1024'

const OrderByParamToSolrFieldMap = {
  date: 'meta_date_dt asc',
  '-date': 'meta_date_dt desc',
}
type OrderByParam = keyof typeof OrderByParamToSolrFieldMap
export const OrderByChoices: OrderByParam[] = Object.keys(OrderByParamToSolrFieldMap) as OrderByParam[]

export interface FindQuery {
  similar_to_image_id?: string
  term?: string
  limit?: number
  offset?: number
  filters?: Filter[]
  order_by?: OrderByParam
}

type ImageService = Pick<ClientService<Image, unknown, unknown, PublicFindResponse<Image>>, 'find' | 'get'>

export class Images implements ImageService {
  constructor(
    private readonly solrClient: SimpleSolrClient,
    private mediaSources: MediaSources,
    private rewriteRules: ImageUrlRewriteRule[]
  ) {}

  async find(params?: Params<FindQuery>): Promise<PublicFindResponse<Image>> {
    const limit = params?.query?.limit ?? DefaultLimit
    const offset = params?.query?.offset ?? 0
    const filters = params?.query?.filters ?? []
    const sort = params?.query?.order_by != null ? OrderByParamToSolrFieldMap[params?.query?.order_by] : undefined

    const filterQueryParts = filtersToSolrQueries(filters, SolrNamespaces.Images)

    const queryParts: string[] = []

    if ((params?.query?.term?.length ?? 0) !== 0) {
      queryParts.push(`caption_txt:${params?.query?.term}`)
    }

    if (params?.query?.similar_to_image_id) {
      const referenceId = params.query.similar_to_image_id
      const referenceImage = await this.getImageDocument(referenceId, [ImageSimilarityVectorField])
      const vector = referenceImage?.[ImageSimilarityVectorField] as number[]

      if (referenceImage == null || vector == null)
        return {
          data: [],
          pagination: {
            limit: limit ?? 0,
            offset: offset ?? 0,
            total: 0,
          },
        }

      queryParts.push(`{!knn f=${ImageSimilarityVectorField} topK=${limit}}${JSON.stringify(vector)}`)
    }

    const query = queryParts.length > 0 ? queryParts.join(' AND ') : '*:*'

    const results = await this.solrClient.select<ImageDocument>(SolrNamespaces.Images, {
      body: {
        query,
        filter: filterQueryParts.join(' AND '),
        limit,
        offset,
        ...(sort != null ? { sort } : {}),
      },
    })

    const mediaSourceLookup = await this.mediaSources.getLookup()

    return {
      data: results?.response?.docs?.map(d => toImage(d, mediaSourceLookup, this.rewriteRules)) ?? [],
      pagination: {
        limit,
        offset,
        total: results?.response?.numFound ?? 0,
      },
    }
  }

  async get(id: Id, params?: Params): Promise<Image> {
    const imageDoc = await this.getImageDocument(String(id))
    if (imageDoc == null) throw new NotFound(`Image with id ${id} not found`)
    const mediaSourceLookup = await this.mediaSources.getLookup()

    return toImage(imageDoc, mediaSourceLookup, this.rewriteRules)
  }

  async getImageDocument(id: string, fields?: (keyof ImageDocument)[]): Promise<ImageDocument | undefined> {
    const result = await this.solrClient.selectOne<ImageDocument>(SolrNamespaces.Images, {
      body: { query: `id:${id}`, limit: 1, fields: fields != null ? fields?.join(',') : undefined },
    })
    return result
  }
}

const toImage = (
  doc: ImageDocument,
  mediaSources: Record<string, MediaSource>,
  rewriteRules: ImageUrlRewriteRule[]
): Image => {
  return {
    uid: doc.id!,
    ...(doc.linked_ci_s != null ? { contentItemUid: doc.linked_ci_s } : {}),
    issueUid: doc.meta_issue_id_s!,
    previewUrl: sanitizeIiifImageUrl(doc.iiif_link_s! ?? doc.iiif_url_s!, rewriteRules),
    date: doc.meta_date_dt!,
    ...(doc.caption_txt != null ? { caption: doc.caption_txt.join('\n') } : {}),
    ...(doc.page_nb_is != null ? { pageNumbers: doc.page_nb_is } : {}),
    mediaSourceRef: {
      uid: doc.meta_journal_s!,
      name: mediaSources[doc.meta_journal_s!]?.name,
      type: 'newspaper',
    },

    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt(doc.rights_bm_explore_l ?? 0),
      getImages: BigInt(doc.rights_bm_get_img_l ?? 0),
      getTranscript: BigInt(doc.rights_bm_get_tr_l ?? 0),
    } satisfies AuthorizationBitmapsDTO,
  }
}
