import { logger } from '../../logger.js'
import debugLib from 'debug'
import { NotFound, NotImplemented } from '@feathersjs/errors'
import { Filter, protobuf } from 'impresso-jscommons'
import { ImpressoApplication } from '../../types.js'
import { Params } from '@feathersjs/feathers'
import User from '../../models/users.model.js'

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

  async create(data: CreateData, params: Params<CreateQuery> & WithUser & { sanitized: CreateQuery }) {
    const client = this.app.get('celeryClient')
    if (!client) {
      return {}
    }

    const q = params.sanitized.sq
    debug('[create] from solr query:', q, 'filters:', params.sanitized.filters)

    const pq = protobuf.searchQuery.serialize({
      filters: params.sanitized.filters ?? [],
    })
    const task = `impresso.tasks.${data.sanitized.taskname}`
    debug('[create] - task:', task, '- protobuffered:', pq)

    const queueService = this.app.service('queueService')

    await queueService.exportSearchResults({
      userId: params.user?.id! as any as string,
      solrNamespace: 'search',
      filters: params.sanitized.filters ?? [],
    })

    return client
      .run({
        task,
        args: [
          // user id
          params.user?.id,
          // query
          q,
          // description
          data.sanitized.description || '',
          // query_hash
          pq,
        ],
      })
      .then(result => {
        debug('[create] result:', result)
        return { taskId: result.taskId }
      })
      .catch(err => {
        if (err.result.exc_type === 'DoesNotExist') {
          throw new NotFound(err.result.exc_message)
        } else if (err.result.exc_type === 'OperationalError') {
          // probably db is not availabe
          throw new NotImplemented()
        }
        logger.error(err)
        throw new NotImplemented()
      })
  }
}
