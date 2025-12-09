import { ClientService } from '@feathersjs/feathers'
import { FindResponse } from '../../models/common'
import { ContentItem } from '../../models/generated/schemas/contentItem'
import { ImpressoApplication } from '../../types'
import { FindParams } from '../content-items/content-items.class'

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
