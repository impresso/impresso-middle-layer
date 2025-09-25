/* eslint-disable no-unused-vars */
import { logger } from '../../logger.js'
import debugLib from 'debug'
const debug = debugLib('impresso/services:search-exporter')
import { NotFound, NotImplemented } from '@feathersjs/errors'
import { protobuf } from 'impresso-jscommons'
import article from '../../models/articles.model'

export class Service {
  constructor(options) {
    this.name = options.name
    this.options = options || {}
    this.app = options.app
    debug('Service created')
  }

  async create(data, params) {
    const client = this.app.get('celeryClient')
    if (!client) {
      return {}
    }

    const q = params.sanitized.sq
    debug('[create] from solr query:', q, 'filters:', params.sanitized.filters)

    const pq = protobuf.searchQuery.serialize({
      filters: params.sanitized.filters,
    })
    const task = `impresso.tasks.${data.sanitized.taskname}`
    debug('[create] - task:', task, '- protobuffered:', pq)

    return client
      .run({
        task,
        args: [
          // user id
          params.user.id,
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

export default function (options) {
  return new Service(options)
}
