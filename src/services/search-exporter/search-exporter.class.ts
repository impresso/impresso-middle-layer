import { Params } from '@feathersjs/feathers'
import debugLib from 'debug'
import { Filter } from 'impresso-jscommons'
import User from '../../models/users.model.js'
import { ImpressoApplication } from '../../types.js'

const debug = debugLib('impresso/services:search-exporter')

interface CreateData {
  taskname: string
  description?: string

  sanitized: CreateData
}
interface WithUser {
  user?: User
}

interface CreateQuery {
  sq?: string
  filters?: Filter[]
}

export class Service {
  app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.app = app
  }

  async create(
    data: CreateData,
    params: Params<CreateQuery> & WithUser & { sanitized: CreateQuery } & { query: { sfq: string[] } }
  ) {
    const client = this.app.get('celeryClient')
    if (!client) {
      return {}
    }

    const q = params.query.sfq.map(term => `(${term})`).join(' AND ')
    debug('[create] from solr query:', q, 'filters:', params.sanitized.filters)

    const task = `impresso.tasks.${data.sanitized.taskname}`
    debug('[create] - task:', task)

    const queueService = this.app.service('queueService')

    await queueService.exportSearchResults({
      userId: String(params.user?.id!),
      userUid: params.user?.uid!,
      solrNamespace: 'search',
      filters: params.sanitized.filters ?? [],
      description: data.sanitized.description,
    })
  }
}
