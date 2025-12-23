import { NotFound } from '@feathersjs/errors'
import { ClientService, Id, Params } from '@feathersjs/feathers'
import { SlimUser } from '@/authentication.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { Filter } from '@/models/index.js'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '@/models/authorization.js'
import { PublicFindResponse } from '@/models/common.js'
import { ImageUrlRewriteRule } from '@/models/generated/common.js'
import { Image, MediaSource } from '@/models/generated/schemas.js'
import { Image as ImageDocument } from '@/models/generated/solr.js'
import { SolrNamespaces } from '@/solr.js'
import { ImpressoApplication } from '@/types.js'
import { getV3CompatibleIIIFUrl, sanitizeIiifImageUrl } from '@/util/iiif.js'
import { isTrue } from '@/util/queryParameters.js'
import { filtersToQueryAndVariables } from '@/util/solr/index.js'
import { vectorToCanonicalEmbedding } from '@/services/impresso-embedder/impresso-embedder.class.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'

const DefaultLimit = 10
export const ImageSimilarityVectorField: keyof ImageDocument = 'dinov2_emb_v1024' satisfies keyof ImageDocument

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
  include_embeddings?: boolean
}

interface WithUser {
  user?: SlimUser
}

interface GetQueryParams {
  include_embeddings?: boolean
}
export type GetParams = Params<GetQueryParams> & WithUser

type ImageService = Pick<ClientService<Image, unknown, unknown, PublicFindResponse<Image>>, 'find' | 'get'>

export class Images implements ImageService {
  constructor(
    private app: ImpressoApplication,
    private readonly solrClient: SimpleSolrClient,
    private mediaSources: MediaSources,
    private rewriteRules: ImageUrlRewriteRule[]
  ) {}

  async find(params?: Params<FindQuery>): Promise<PublicFindResponse<Image>> {
    const limit = params?.query?.limit ?? DefaultLimit
    const offset = params?.query?.offset ?? 0
    const filters = params?.query?.filters ?? []
    const sort = params?.query?.order_by != null ? OrderByParamToSolrFieldMap[params?.query?.order_by] : undefined

    const { query: extraQuery, filter: filterQueryParts } = filtersToQueryAndVariables(
      filters,
      SolrNamespaces.Images,
      this.app.get('solrConfiguration').namespaces ?? []
    )

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
        query: (extraQuery as string).length > 0 ? `(${query}) AND (${extraQuery})` : query,
        filter: filterQueryParts,
        limit,
        offset,
        ...(sort != null ? { sort } : {}),
      },
    })

    const mediaSourceLookup = await this.mediaSources.getLookup()

    return {
      data:
        results?.response?.docs?.map(d =>
          toImage(d, mediaSourceLookup, this.rewriteRules, isTrue(params?.query?.include_embeddings))
        ) ?? [],
      pagination: {
        limit,
        offset,
        total: results?.response?.numFound ?? 0,
      },
    }
  }

  async get(id: Id, params?: GetParams): Promise<Image> {
    const imageDoc = await this.getImageDocument(String(id))
    if (imageDoc == null) throw new NotFound(`Image with id ${id} not found`)
    const mediaSourceLookup = await this.mediaSources.getLookup()

    return toImage(imageDoc, mediaSourceLookup, this.rewriteRules, isTrue(params?.query?.include_embeddings))
  }

  async getImageDocument(id: string, fields?: (keyof ImageDocument)[]): Promise<ImageDocument | undefined> {
    const result = await this.solrClient.selectOne<ImageDocument>(SolrNamespaces.Images, {
      body: { query: `id:${id}`, limit: 1, fields: fields != null ? fields?.join(',') : undefined },
    })
    return result
  }
}

type EmbeddingField = keyof Pick<ImageDocument, 'openclip_emb_v768' | 'dinov2_emb_v1024'>

const EmbeddingsFieldsWithModelTag: [EmbeddingField, string][] = [
  ['openclip_emb_v768', 'openclip-768'],
  ['dinov2_emb_v1024', 'dinov2-1024'],
]

/**
 * Mapping of image type field to a mapping of their Solr values to their labels.
 * Keep in sync with this: https://github.com/impresso/impresso-pyindexing/blob/61f4504ca71c7d856e52885415b43e9863a77f6f/impresso_solr/solr_importers/enum.py#L55
 */
export const ImageTypeValueLookup: Record<
  keyof Pick<ImageDocument, 'type_l0_tp' | 'type_l1_tp' | 'type_l2_tp' | 'type_l3_tp'>,
  Record<string, string>
> = {
  type_l0_tp: {
    image: 'Image',
    not_image: 'Not an Image',
  },
  type_l1_tp: {
    photograph: 'Photograph',
    not_photograph: 'Not a Photograph',
  },
  type_l2_tp: {
    decorative: 'Decorative',
    informative_or_illustrative: 'Informative or Illustrative',
    advertising: 'Advertising',
    entertainment: 'Entertainment',
  },
  type_l3_tp: {
    caricature_humoristic_drawing: 'Caricature or Humoristic Drawing',
    comic_strip: 'Comic Strip',
    illustrated_story: 'Illustrated Story',
    game: 'Game',
    graph: 'Graph',
    technical_drawing: 'Technical Drawing',
    human_rep_fashion_visual: 'Human Representation - Fashion Visual',
    human_rep_portrait: 'Human Representation - Portrait',
    human_rep_scene: 'Human Representation - Scene',
    scenery_landscape: 'Scenery or Landscape',
    map_geological: 'Map - Geological',
    map_geopolitical: 'Map - Geopolitical',
    map_physical_or_roadmap: 'Map - Physical or Roadmap',
    map_plan: 'Map - Plan',
    map_weather: 'Map - Weather',
    weather_infographic: 'Weather Infographic',
    non_figurative_visual_content: 'Non-Figurative Visual Content',
    object: 'Object',
    ornament_illustrated_title: 'Ornament or Illustrated Title',
    other: 'Other',
  },
}

const toTypes = (doc: ImageDocument): Image['imageTypes'] => {
  const types: Image['imageTypes'] = {}
  if (doc['type_l0_tp'] != null) {
    types['visualContent'] = ImageTypeValueLookup['type_l0_tp'][doc['type_l0_tp']] ?? doc['type_l0_tp']
  }
  if (doc['type_l1_tp'] != null) {
    types['technique'] = ImageTypeValueLookup['type_l1_tp'][doc['type_l1_tp']] ?? doc['type_l1_tp']
  }
  if (doc['type_l2_tp'] != null) {
    types['communicationGoal'] = ImageTypeValueLookup['type_l2_tp'][doc['type_l2_tp']] ?? doc['type_l2_tp']
  }
  if (doc['type_l3_tp'] != null) {
    types['visualContentType'] = ImageTypeValueLookup['type_l3_tp'][doc['type_l3_tp']] ?? doc['type_l3_tp']
  }
  return Object.keys(types).length > 0 ? types : undefined
}

const toImage = (
  doc: ImageDocument,
  mediaSources: Record<string, MediaSource>,
  rewriteRules: ImageUrlRewriteRule[],
  includeEmbeddings: boolean
): Image => {
  const embeddings = includeEmbeddings
    ? EmbeddingsFieldsWithModelTag.map(([field, modelTag]) => {
        const value = doc[field]
        if (value == null) return undefined
        return vectorToCanonicalEmbedding(value, modelTag)
      }).filter(v => v != null)
    : undefined

  const imageTypes = toTypes(doc)

  return {
    uid: doc.id!,
    ...(doc.linked_ci_s != null ? { contentItemUid: doc.linked_ci_s } : {}),
    issueUid: doc.meta_issue_id_s!,
    previewUrl: getV3CompatibleIIIFUrl(sanitizeIiifImageUrl(doc.iiif_link_s! ?? doc.iiif_url_s!, rewriteRules))!,
    date: doc.meta_date_dt!,
    ...(doc.caption_txt != null ? { caption: doc.caption_txt.join('\n') } : {}),
    ...(doc.page_nb_is != null ? { pageNumbers: doc.page_nb_is } : {}),
    mediaSourceRef: {
      uid: doc.meta_journal_s!,
      name: mediaSources[doc.meta_journal_s!]?.name,
      type: 'newspaper',
    },
    ...(imageTypes != null && Object.keys(imageTypes).length > 0 ? { imageTypes } : {}),
    ...(embeddings != null && embeddings.length > 0 ? { embeddings } : {}),
    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt(doc.rights_bm_explore_l ?? 0),
      getImages: BigInt(doc.rights_bm_get_img_l ?? 0),
      getTranscript: BigInt(doc.rights_bm_get_tr_l ?? 0),
    } satisfies AuthorizationBitmapsDTO,
  }
}
