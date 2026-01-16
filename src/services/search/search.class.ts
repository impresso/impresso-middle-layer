import { ClientService } from '@feathersjs/feathers'
import { FindResponse } from '@/models/common.js'
import { ContentItem } from '@/models/generated/schemas/contentItem.js'
import { ImpressoApplication } from '@/types.js'
import { FindParams } from '@/services/content-items/content-items.class.js'

type SearchService = Pick<ClientService<ContentItem, unknown, unknown, FindResponse<ContentItem>>, 'find'>

class Service implements SearchService {
  constructor(private readonly app: ImpressoApplication) {}

  /**
   * Proxy for `content-items.find()`.
   * Used in the public API.
   */
  async find(params: FindParams) {
    return await this.app.service('content-items').find(params)
  }
}

export { Service }
