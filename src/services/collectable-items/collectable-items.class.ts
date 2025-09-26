import { Id, NullableId, Params } from '@feathersjs/feathers'
import { CollectableItemsUpdatedResponse, UpdateCollectableItemsRequest } from '../../models/generated/shared'
import { BadRequest, NotAuthenticated } from '@feathersjs/errors'
import { SlimUser } from '../../authentication'
import { addItemsToCollection } from '../../jobs/collections/addItemsToCollection'
import { removeItemsFromCollection } from '../../jobs/collections/removeItemsFromCollection'
import { ImpressoApplication } from '../../types'

interface WithUser {
  user?: SlimUser
}

type PatchParams = WithUser & {
  route?: {
    collection_id?: string
  }
}

// export type ICollectableItemsService = Pick<
//   ClientService<CollectableItemsUpdatedResponse, unknown, UpdateCollectableItemsRequest, unknown, PatchParams>,
//   'patch'
// >

export type ICollectableItemsService = {
  patch(
    id: Id | NullableId,
    data: UpdateCollectableItemsRequest,
    params: PatchParams
  ): Promise<CollectableItemsUpdatedResponse>
}

export class CollectableItemsService implements ICollectableItemsService {
  protected readonly app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.app = app
  }

  async patch(id: Id | NullableId, data: UpdateCollectableItemsRequest, params: PatchParams) {
    if (id != null) throw new BadRequest('Not a single item update endpoint')

    const userId = params.user?.uid
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
      totalRemoved: data.add?.length ?? 0,
    }
  }
}
