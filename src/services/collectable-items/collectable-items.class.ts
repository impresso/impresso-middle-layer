import { Id, NullableId } from '@feathersjs/feathers'
import {
  AddCollectableItemsFromFilters,
  CollectableItemsUpdatedResponse,
  UpdateCollectableItemsRequest,
} from '../../models/generated/shared'
import { BadRequest, NotAuthenticated } from '@feathersjs/errors'
import { SlimUser } from '../../authentication'
import { addItemsToCollection } from '../../jobs/collections/addItemsToCollection'
import { removeItemsFromCollection } from '../../jobs/collections/removeItemsFromCollection'
import { ImpressoApplication } from '../../types'
import { SolrNamespaces } from '../../solr'
import { filterAdapter } from '../../util/models'

interface WithUser {
  user?: SlimUser
}

type Params = WithUser & {
  route?: {
    collection_id?: string
  }
}

// export type ICollectableItemsService = Pick<
//   ClientService<CollectableItemsUpdatedResponse, unknown, UpdateCollectableItemsRequest, unknown, PatchParams>,
//   'patch'
// >

const SupportedNamespaces = [SolrNamespaces.Search, SolrNamespaces.TextReusePassages]

export type ICollectableItemsService = {
  create(data: AddCollectableItemsFromFilters, params: Params): Promise<unknown>

  patch(
    id: Id | NullableId,
    data: UpdateCollectableItemsRequest,
    params: Params
  ): Promise<CollectableItemsUpdatedResponse>
}

export class CollectableItemsService implements ICollectableItemsService {
  protected readonly app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.app = app
  }

  async create(data: AddCollectableItemsFromFilters, params: Params) {
    if (params.user?.id == null) throw new NotAuthenticated('User authentication required')

    const collectionId = params.route?.collection_id
    if (collectionId == null) throw new BadRequest('Collection UID not provided')

    if (SupportedNamespaces.includes(data.namespace) === false)
      throw new BadRequest(
        `Invalid namespace: ${data.namespace}. Supported namespaces: ${SupportedNamespaces.join(', ')}`
      )
    if (data.filters == null || data.filters.length === 0)
      throw new BadRequest('At least one filter must be provided to add items to collection')

    const queueService = this.app.service('queueService')
    await queueService.addQueryResultItemsToCollection({
      userId: String(params.user.id),
      collectionId,
      solrNamespace: data.namespace,
      filters: data.filters.map(filterAdapter),
    })
  }

  async patch(id: Id | NullableId, data: UpdateCollectableItemsRequest, params: Params) {
    if (id != null) throw new BadRequest('Not a single item update endpoint')

    const userId = String(params.user?.id)
    if (userId == null) throw new NotAuthenticated('User authentication required')

    const collectionId = params.route?.collection_id
    if (collectionId == null) throw new BadRequest('Collection UID not provided')

    if (data.add != null && data.add.length > 0) {
      // we have a job handler but we can also run it directly for immediate feedback
      await addItemsToCollection(this.app, {
        userId,
        collectionId: collectionId,
        itemIds: data.add,
      })
    }
    if (data.remove != null && data.remove.length > 0) {
      // we have a job handler but we can also run it directly for immediate feedback
      await removeItemsFromCollection(this.app, {
        userId: userId,
        collectionId: collectionId,
        itemIds: data.remove,
      })
    }

    return {
      totalAdded: data.add?.length ?? 0,
      totalRemoved: data.remove?.length ?? 0,
    }
  }
}
