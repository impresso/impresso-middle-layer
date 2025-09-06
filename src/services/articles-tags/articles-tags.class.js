/* eslint-disable no-unused-vars */
import debugLib from 'debug'
const debug = debugLib('impresso/services:articles-tags')
import shash from 'short-hash'
import { NotImplemented } from '@feathersjs/errors'
import { Neo4jService as Service } from '../neo4j.service'

/**
 * @deprecated
 */
export class Service extends Neo4jService {
  async create(data, params) {
    const tagUid = [params.user.uid, shash(`${data.sanitized.tag}`)].join('-')

    debug(`create: tag '${tagUid}' by user '${params.user.uid}'`)

    const result = await this._run(this.queries.merge, {
      user_uid: params.user.uid,
      article_uid: data.sanitized.article_uid,
      tag_uid: tagUid,
      tag_name: data.sanitized.tag,
    })

    return this._finalizeCreateOne(result)
  }

  async remove(id, params) {
    //
    const result = await this._run(this.queries.remove, {
      user_uid: params.user.uid,
      article_uid: id,
      tag_uid: params.query.tag_uid,
    })
    debug('remove:', id, 'stats:', result.summary.counters._stats)
    return this._finalizeRemove(result)
  }

  async find(params) {
    throw new NotImplemented()
  }
}

export default function (options) {
  return new Service(options)
}
