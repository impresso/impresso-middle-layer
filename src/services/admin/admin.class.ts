import { ClientService, Params } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import {
  ContentItemPermissionsDetails,
  getContentItemsPermissionsDetails,
} from '../../useCases/getContentItemsPermissionsDetails'

interface FindResponse {
  permissionsDetails: ContentItemPermissionsDetails
}
interface FindParams {}

type IService = Pick<ClientService<unknown, unknown, unknown, FindResponse>, 'find'>

export class Service implements IService {
  constructor(private readonly app: ImpressoApplication) {}

  async find(params?: Params<FindParams>): Promise<FindResponse> {
    const permissionsDetails = await getContentItemsPermissionsDetails(this.app.service('simpleSolrClient'))
    return { permissionsDetails } satisfies FindResponse
  }
}
