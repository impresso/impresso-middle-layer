import { ClientService, Params, Query } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'
import {
  ContentItemPermissionsDetails,
  getContentItemsPermissionsDetails,
} from '@/useCases/getContentItemsPermissionsDetails.js'
import { getUserAccountsWithAvailablePermissions, UserAccount } from '@/useCases/getUsersPermissionsDetails.js'

interface FindResponse {
  contentItemsPermissionsDetails: ContentItemPermissionsDetails
  imagesPermissionsDetails: ContentItemPermissionsDetails
  userAccounts: UserAccount[]
}
interface FindParams {}

type IService = Pick<ClientService<unknown, {}, unknown, FindResponse>, 'find'>

export class Service implements IService {
  constructor(private readonly app: ImpressoApplication) {}

  async find(params?: Params<FindParams>): Promise<FindResponse> {
    // await this.app.service('queueService').migrateOldCollections({})
    const [contentItemsPermissionsDetails, imagesPermissionsDetails] = await Promise.all([
      getContentItemsPermissionsDetails(this.app.service('simpleSolrClient'), 'Search'),
      getContentItemsPermissionsDetails(this.app.service('simpleSolrClient'), 'Images'),
    ])

    const userAccounts = await getUserAccountsWithAvailablePermissions(this.app.get('sequelizeClient')!)
    return { contentItemsPermissionsDetails, imagesPermissionsDetails, userAccounts } satisfies FindResponse
  }
}
